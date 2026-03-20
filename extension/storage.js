(function (global) {
  'use strict';

  var STORAGE_KEY = 'monitoredEntries';
  var MAX_TITLE_LENGTH = 200;
  var MAX_SELECTOR_LENGTH = 4096;
  var MAX_FIELD_LABEL_LENGTH = 120;
  var MAX_FIELD_VALUE_LENGTH = 4000;

  function storageGet(defaultValue) {
    return new Promise(function (resolve, reject) {
      if (!global.chrome || !chrome.storage || !chrome.storage.local) {
        resolve(defaultValue);
        return;
      }

      chrome.storage.local.get(defaultValue, function (items) {
        var error = chrome.runtime && chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve(items);
      });
    });
  }

  function storageSet(items) {
    return new Promise(function (resolve, reject) {
      if (!global.chrome || !chrome.storage || !chrome.storage.local) {
        resolve();
        return;
      }

      chrome.storage.local.set(items, function () {
        var error = chrome.runtime && chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve();
      });
    });
  }

  function generateId() {
    if (global.crypto && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }

    if (!global.crypto || typeof global.crypto.getRandomValues !== 'function') {
      return Math.random().toString(16).slice(2) + Date.now().toString(16);
    }

    var bytes = new Uint8Array(16);
    global.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    var hex = Array.prototype.map
      .call(bytes, function (byte) {
        return byte.toString(16).padStart(2, '0');
      })
      .join('');

    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20),
    ].join('-');
  }

  function clampText(value, limit) {
    if (typeof value !== 'string') {
      return '';
    }

    var trimmed = value.trim();
    if (!trimmed) {
      return '';
    }

    if (trimmed.length <= limit) {
      return trimmed;
    }

    return trimmed.slice(0, limit - 1).trimEnd() + '\u2026';
  }

  function normalizeHttpUrl(rawValue) {
    if (typeof rawValue !== 'string') {
      return null;
    }

    var candidate = rawValue.trim();
    if (!candidate) {
      return null;
    }

    try {
      var url = new URL(candidate);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return null;
      }
      return url.href;
    } catch (_error) {
      return null;
    }
  }

  function deriveTitleFromUrl(pageUrl) {
    try {
      var url = new URL(pageUrl);
      return url.hostname.replace(/^www\./, '');
    } catch (_error) {
      return 'Untitled';
    }
  }

  function defaultFaviconUrl(pageUrl) {
    try {
      var url = new URL(pageUrl);
      return url.origin + '/favicon.ico';
    } catch (_error) {
      return '';
    }
  }

  function stripHtmlToText(html) {
    if (typeof html !== 'string' || !html) {
      return '';
    }

    return html
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  function normalizeField(field, fallbackIndex) {
    if (!field || typeof field !== 'object') {
      return null;
    }

    var selector = clampText(field.selector, MAX_SELECTOR_LENGTH);
    if (!selector) {
      return null;
    }

    var label = clampText(field.label, MAX_FIELD_LABEL_LENGTH) || 'Field ' + (fallbackIndex + 1);
    var valueText = clampText(
      typeof field.valueText === 'string' && field.valueText ? field.valueText : field.previewText || '',
      MAX_FIELD_VALUE_LENGTH
    );

    return {
      id: typeof field.id === 'string' && field.id.trim() ? field.id.trim() : generateId(),
      label: label,
      selector: selector,
      valueText: valueText,
    };
  }

  function normalizeFields(fields) {
    if (!Array.isArray(fields)) {
      return [];
    }

    var seenIds = new Set();
    var normalized = [];

    fields.forEach(function (field, index) {
      var normalizedField = normalizeField(field, index);
      if (!normalizedField || seenIds.has(normalizedField.id)) {
        return;
      }

      seenIds.add(normalizedField.id);
      normalized.push(normalizedField);
    });

    return normalized;
  }

  function normalizeEntry(entry, fallbackOrder) {
    if (!entry || typeof entry !== 'object') {
      return null;
    }

    var pageUrl = normalizeHttpUrl(entry.pageUrl);
    if (!pageUrl) {
      return null;
    }

    var title = clampText(entry.title, MAX_TITLE_LENGTH) || deriveTitleFromUrl(pageUrl);
    var id = typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : generateId();
    var order = Number.isInteger(entry.order) && entry.order >= 0 ? entry.order : fallbackOrder;
    var faviconUrl = typeof entry.faviconUrl === 'string' && entry.faviconUrl.trim()
      ? entry.faviconUrl.trim()
      : defaultFaviconUrl(pageUrl);
    var fields = normalizeFields(entry.fields);

    if (!fields.length && typeof entry.selector === 'string' && entry.selector.trim()) {
      fields = [
        {
          id: generateId(),
          label: 'Field 1',
          selector: clampText(entry.selector, MAX_SELECTOR_LENGTH),
          valueText: clampText(
            stripHtmlToText(typeof entry.previewHtml === 'string' ? entry.previewHtml : ''),
            MAX_FIELD_VALUE_LENGTH
          ),
        },
      ];
    }

    if (!fields.length) {
      return null;
    }

    return {
      id: id,
      pageUrl: pageUrl,
      title: title,
      faviconUrl: faviconUrl,
      order: order,
      fields: fields,
      updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : '',
    };
  }

  function normalizeEntries(entries) {
    if (!Array.isArray(entries)) {
      return [];
    }

    var seenIds = new Set();
    var normalized = [];

    entries.forEach(function (entry, index) {
      var normalizedEntry = normalizeEntry(entry, index);
      if (!normalizedEntry || seenIds.has(normalizedEntry.id)) {
        return;
      }

      seenIds.add(normalizedEntry.id);
      normalized.push(normalizedEntry);
    });

    normalized.sort(function (left, right) {
      if (left.order !== right.order) {
        return left.order - right.order;
      }

      return left.id.localeCompare(right.id);
    });

    return normalized.map(function (entry, index) {
      return Object.assign({}, entry, { order: index });
    });
  }

  async function loadEntries() {
    var items = await storageGet({ [STORAGE_KEY]: [] });
    return normalizeEntries(items[STORAGE_KEY]);
  }

  async function saveEntries(entries) {
    var normalized = normalizeEntries(entries);
    await storageSet({ [STORAGE_KEY]: normalized });
    return normalized;
  }

  function upsertEntry(entries, nextEntry) {
    var normalized = normalizeEntry(nextEntry, entries.length);
    if (!normalized) {
      return normalizeEntries(entries);
    }

    var updated = entries.slice();
    var index = updated.findIndex(function (entry) {
      return entry.id === normalized.id;
    });

    if (index >= 0) {
      updated[index] = Object.assign({}, updated[index], normalized);
    } else {
      updated.push(normalized);
    }

    return normalizeEntries(updated);
  }

  function removeEntry(entries, entryId) {
    return normalizeEntries(
      entries.filter(function (entry) {
        return entry.id !== entryId;
      })
    );
  }

  function reindexEntries(entries) {
    return normalizeEntries(entries);
  }

  function isHttpUrl(value) {
    return normalizeHttpUrl(value) !== null;
  }

  global.AIUsageStorage = {
    STORAGE_KEY: STORAGE_KEY,
    MAX_TITLE_LENGTH: MAX_TITLE_LENGTH,
    MAX_SELECTOR_LENGTH: MAX_SELECTOR_LENGTH,
    MAX_FIELD_LABEL_LENGTH: MAX_FIELD_LABEL_LENGTH,
    MAX_FIELD_VALUE_LENGTH: MAX_FIELD_VALUE_LENGTH,
    generateId: generateId,
    clampText: clampText,
    normalizeHttpUrl: normalizeHttpUrl,
    deriveTitleFromUrl: deriveTitleFromUrl,
    defaultFaviconUrl: defaultFaviconUrl,
    stripHtmlToText: stripHtmlToText,
    normalizeField: normalizeField,
    normalizeFields: normalizeFields,
    normalizeEntry: normalizeEntry,
    normalizeEntries: normalizeEntries,
    loadEntries: loadEntries,
    saveEntries: saveEntries,
    upsertEntry: upsertEntry,
    removeEntry: removeEntry,
    reindexEntries: reindexEntries,
    isHttpUrl: isHttpUrl,
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
