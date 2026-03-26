(function (global) {
  'use strict';

  var STORAGE_KEY = 'pins';
  var LEGACY_STORAGE_KEY = 'monitoredEntries';
  var MAX_TITLE_LENGTH = 200;
  var MAX_SELECTOR_LENGTH = 4096;
  var MAX_SAVED_CONTENT_LENGTH = 12000;
  var MAX_PREVIEW_LENGTH = 240;

  function storageGet(query) {
    return new Promise(function (resolve, reject) {
      if (!global.chrome || !chrome.storage || !chrome.storage.local) {
        resolve({});
        return;
      }

      chrome.storage.local.get(query, function (items) {
        var error = chrome.runtime && chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }

        resolve(items || {});
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

    return trimmed.slice(0, limit - 3).trimEnd() + '...';
  }

  function normalizeWhitespace(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .trim();
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
      return 'Untitled pin';
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

  function isMeaningfulText(value) {
    var normalized = normalizeWhitespace(value);
    if (!normalized) {
      return false;
    }

    return /[A-Za-z0-9]/.test(normalized);
  }

  function createPreviewText(value) {
    return clampText(normalizeWhitespace(value), MAX_PREVIEW_LENGTH);
  }

  function normalizeTimestamp(value, fallback) {
    var timestamp = typeof value === 'string' ? value.trim() : '';
    if (!timestamp) {
      return fallback;
    }

    var parsed = new Date(timestamp);
    if (Number.isNaN(parsed.getTime())) {
      return fallback;
    }

    return parsed.toISOString();
  }

  function derivePinTitle(options) {
    var preferred = clampText(options.preferredTitle || '', MAX_TITLE_LENGTH);
    if (preferred) {
      return preferred;
    }

    var fieldLabel = clampText(options.fieldLabel || '', MAX_TITLE_LENGTH);
    if (fieldLabel && !/^field\s+\d+$/i.test(fieldLabel)) {
      return fieldLabel;
    }

    var pageTitle = clampText(options.pageTitle || '', MAX_TITLE_LENGTH);
    if (pageTitle) {
      return pageTitle;
    }

    var preview = createPreviewText(options.savedContent || '');
    if (preview) {
      return clampText(preview, MAX_TITLE_LENGTH);
    }

    return deriveTitleFromUrl(options.pageUrl || '');
  }

  function normalizePin(pin, fallbackOrder) {
    if (!pin || typeof pin !== 'object') {
      return null;
    }

    var pageUrl = normalizeHttpUrl(pin.pageUrl);
    if (!pageUrl) {
      return null;
    }

    var selector = clampText(pin.selector, MAX_SELECTOR_LENGTH);
    var savedContent = clampText(
      stripHtmlToText(typeof pin.savedContent === 'string' ? pin.savedContent : pin.valueText || ''),
      MAX_SAVED_CONTENT_LENGTH
    );

    if (!selector || !savedContent) {
      return null;
    }

    var now = new Date().toISOString();
    var order = Number.isInteger(pin.order) && pin.order >= 0 ? pin.order : fallbackOrder;
    var pageTitle = clampText(pin.pageTitle || '', MAX_TITLE_LENGTH);
    var previewText = createPreviewText(pin.previewText || savedContent);
    var title = derivePinTitle({
      preferredTitle: pin.title,
      fieldLabel: pin.fieldLabel,
      pageTitle: pageTitle,
      savedContent: savedContent,
      pageUrl: pageUrl,
    });

    return {
      id: typeof pin.id === 'string' && pin.id.trim() ? pin.id.trim() : generateId(),
      title: title,
      pageUrl: pageUrl,
      pageTitle: pageTitle,
      faviconUrl: clampText(pin.faviconUrl || '', 2048) || defaultFaviconUrl(pageUrl),
      selector: selector,
      savedContent: savedContent,
      previewText: previewText || clampText(savedContent, MAX_PREVIEW_LENGTH),
      order: order,
      createdAt: normalizeTimestamp(pin.createdAt, now),
      updatedAt: normalizeTimestamp(pin.updatedAt, now),
    };
  }

  function normalizePins(pins) {
    if (!Array.isArray(pins)) {
      return [];
    }

    var seenIds = new Set();
    var normalized = [];

    pins.forEach(function (pin, index) {
      var normalizedPin = normalizePin(pin, index);
      if (!normalizedPin || seenIds.has(normalizedPin.id)) {
        return;
      }

      seenIds.add(normalizedPin.id);
      normalized.push(normalizedPin);
    });

    normalized.sort(function (left, right) {
      if (left.order !== right.order) {
        return left.order - right.order;
      }

      return left.id.localeCompare(right.id);
    });

    return normalized.map(function (pin, index) {
      return Object.assign({}, pin, { order: index });
    });
  }

  function normalizeLegacyFields(entry) {
    if (!entry || typeof entry !== 'object') {
      return [];
    }

    if (Array.isArray(entry.fields)) {
      return entry.fields
        .map(function (field, index) {
          if (!field || typeof field !== 'object') {
            return null;
          }

          var selector = clampText(field.selector, MAX_SELECTOR_LENGTH);
          var valueText = clampText(
            stripHtmlToText(
              typeof field.valueText === 'string'
                ? field.valueText
                : typeof field.previewText === 'string'
                  ? field.previewText
                  : ''
            ),
            MAX_SAVED_CONTENT_LENGTH
          );

          if (!selector || !valueText) {
            return null;
          }

          return {
            label: clampText(field.label || '', MAX_TITLE_LENGTH) || 'Field ' + (index + 1),
            selector: selector,
            valueText: valueText,
          };
        })
        .filter(Boolean);
    }

    if (typeof entry.selector === 'string' && entry.selector.trim()) {
      var value = clampText(
        stripHtmlToText(typeof entry.previewHtml === 'string' ? entry.previewHtml : ''),
        MAX_SAVED_CONTENT_LENGTH
      );

      if (value) {
        return [
          {
            label: clampText(entry.title || '', MAX_TITLE_LENGTH) || 'Field 1',
            selector: clampText(entry.selector, MAX_SELECTOR_LENGTH),
            valueText: value,
          },
        ];
      }
    }

    return [];
  }

  function migrateLegacyEntries(entries) {
    if (!Array.isArray(entries)) {
      return [];
    }

    var now = new Date().toISOString();
    var pins = [];

    entries.forEach(function (entry) {
      var pageUrl = normalizeHttpUrl(entry && entry.pageUrl);
      if (!pageUrl) {
        return;
      }

      var fields = normalizeLegacyFields(entry);
      if (!fields.length) {
        return;
      }

      fields.forEach(function (field, index) {
        var multipleFields = fields.length > 1;
        var title = multipleFields
          ? field.label || entry.title
          : entry.title || field.label;

        var pin = normalizePin(
          {
            id: generateId(),
            title: title,
            pageUrl: pageUrl,
            pageTitle: entry.title || '',
            faviconUrl: entry.faviconUrl || '',
            selector: field.selector,
            savedContent: field.valueText,
            previewText: createPreviewText(field.valueText),
            order: pins.length + index,
            createdAt: entry.updatedAt || now,
            updatedAt: entry.updatedAt || now,
          },
          pins.length + index
        );

        if (pin) {
          pins.push(pin);
        }
      });
    });

    return normalizePins(pins);
  }

  function buildPinFromCapture(options) {
    var existingPin = options && options.existingPin ? options.existingPin : null;
    var capture = options && options.capture ? options.capture : {};
    var field = capture.field || {};
    var savedContent = clampText(
      stripHtmlToText(typeof field.valueText === 'string' ? field.valueText : ''),
      MAX_SAVED_CONTENT_LENGTH
    );

    if (!isMeaningfulText(savedContent)) {
      return null;
    }

    var now = new Date().toISOString();

    return normalizePin(
      {
        id: existingPin ? existingPin.id : capture.id,
        title: derivePinTitle({
          preferredTitle: options.titleHint || (existingPin && existingPin.title) || field.label,
          fieldLabel: field.label,
          pageTitle: capture.pageTitle || (existingPin && existingPin.pageTitle) || '',
          savedContent: savedContent,
          pageUrl: capture.pageUrl || (existingPin && existingPin.pageUrl) || '',
        }),
        pageUrl: capture.pageUrl || (existingPin && existingPin.pageUrl) || '',
        pageTitle: capture.pageTitle || (existingPin && existingPin.pageTitle) || '',
        faviconUrl: capture.faviconUrl || (existingPin && existingPin.faviconUrl) || '',
        selector: field.selector || (existingPin && existingPin.selector) || '',
        savedContent: savedContent,
        previewText: createPreviewText(savedContent),
        order: existingPin ? existingPin.order : options.order,
        createdAt: existingPin ? existingPin.createdAt : now,
        updatedAt: now,
      },
      typeof options.order === 'number' ? options.order : 0
    );
  }

  async function loadPins() {
    var items = await storageGet([STORAGE_KEY, LEGACY_STORAGE_KEY]);
    var storedPins = normalizePins(items[STORAGE_KEY]);

    if (storedPins.length) {
      if (JSON.stringify(storedPins) !== JSON.stringify(items[STORAGE_KEY])) {
        await storageSet({
          [STORAGE_KEY]: storedPins,
          [LEGACY_STORAGE_KEY]: [],
        });
      }

      return storedPins;
    }

    var legacyPins = migrateLegacyEntries(items[LEGACY_STORAGE_KEY]);
    if (legacyPins.length) {
      await storageSet({
        [STORAGE_KEY]: legacyPins,
        [LEGACY_STORAGE_KEY]: [],
      });
      return legacyPins;
    }

    return [];
  }

  async function savePins(pins) {
    var normalized = normalizePins(pins);
    await storageSet({
      [STORAGE_KEY]: normalized,
      [LEGACY_STORAGE_KEY]: [],
    });
    return normalized;
  }

  function upsertPin(pins, nextPin) {
    var normalized = normalizePin(nextPin, pins.length);
    if (!normalized) {
      return normalizePins(pins);
    }

    var updated = pins.slice();
    var index = updated.findIndex(function (pin) {
      return pin.id === normalized.id;
    });

    if (index >= 0) {
      updated[index] = Object.assign({}, updated[index], normalized);
    } else {
      updated.push(normalized);
    }

    return normalizePins(updated);
  }

  function removePin(pins, pinId) {
    return normalizePins(
      pins.filter(function (pin) {
        return pin.id !== pinId;
      })
    );
  }

  function reindexPins(pins) {
    return normalizePins(pins);
  }

  function isHttpUrl(value) {
    return normalizeHttpUrl(value) !== null;
  }

  global.AIUsageStorage = {
    STORAGE_KEY: STORAGE_KEY,
    LEGACY_STORAGE_KEY: LEGACY_STORAGE_KEY,
    MAX_TITLE_LENGTH: MAX_TITLE_LENGTH,
    MAX_SELECTOR_LENGTH: MAX_SELECTOR_LENGTH,
    MAX_SAVED_CONTENT_LENGTH: MAX_SAVED_CONTENT_LENGTH,
    MAX_PREVIEW_LENGTH: MAX_PREVIEW_LENGTH,
    generateId: generateId,
    clampText: clampText,
    normalizeWhitespace: normalizeWhitespace,
    normalizeHttpUrl: normalizeHttpUrl,
    deriveTitleFromUrl: deriveTitleFromUrl,
    defaultFaviconUrl: defaultFaviconUrl,
    stripHtmlToText: stripHtmlToText,
    isMeaningfulText: isMeaningfulText,
    createPreviewText: createPreviewText,
    derivePinTitle: derivePinTitle,
    normalizePin: normalizePin,
    normalizePins: normalizePins,
    migrateLegacyEntries: migrateLegacyEntries,
    buildPinFromCapture: buildPinFromCapture,
    loadPins: loadPins,
    savePins: savePins,
    upsertPin: upsertPin,
    removePin: removePin,
    reindexPins: reindexPins,
    isHttpUrl: isHttpUrl,
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
