importScripts('storage.js', 'sanitize.js');

(function () {
  'use strict';

  var pendingPickerSessions = new Map();
  var PICKER_TAB_LOAD_TIMEOUT_MS = 25000;
  var REFRESH_TIMEOUT_MS = 25000;

  function callbackToPromise(setup) {
    return new Promise(function (resolve, reject) {
      setup(function (result) {
        var error = chrome.runtime && chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }

        resolve(result);
      });
    });
  }

  function tabsCreate(createProperties) {
    return callbackToPromise(function (resolve) {
      chrome.tabs.create(createProperties, resolve);
    });
  }

  function tabsRemove(tabId) {
    return callbackToPromise(function (resolve) {
      chrome.tabs.remove(tabId, resolve);
    });
  }

  function tabsReload(tabId) {
    return callbackToPromise(function (resolve) {
      chrome.tabs.reload(tabId, {}, resolve);
    });
  }

  function tabsQuery(queryInfo) {
    return callbackToPromise(function (resolve) {
      chrome.tabs.query(queryInfo, resolve);
    });
  }

  function tabsGet(tabId) {
    return callbackToPromise(function (resolve) {
      chrome.tabs.get(tabId, resolve);
    });
  }

  function executeScript(details) {
    return callbackToPromise(function (resolve) {
      chrome.scripting.executeScript(details, resolve);
    });
  }

  function formatError(error) {
    if (!error) {
      return 'Unknown error';
    }

    if (typeof error === 'string') {
      return error;
    }

    if (error.message) {
      return error.message;
    }

    return 'Unexpected failure';
  }

  function normalizePath(pathname) {
    if (!pathname) {
      return '/';
    }

    if (pathname.length > 1 && pathname.endsWith('/')) {
      return pathname.slice(0, -1);
    }

    return pathname;
  }

  function isCompatibleTabUrl(entryUrl, tabUrl) {
    try {
      var entry = new URL(entryUrl);
      var tab = new URL(tabUrl);

      if (entry.origin !== tab.origin) {
        return false;
      }

      var entryPath = normalizePath(entry.pathname);
      var tabPath = normalizePath(tab.pathname);

      return (
        tabPath === entryPath ||
        tabPath.indexOf(entryPath + '/') === 0 ||
        entryPath.indexOf(tabPath + '/') === 0
      );
    } catch (_error) {
      return false;
    }
  }

  function waitForTabComplete(tabId, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var timeoutId = setTimeout(function () {
        cleanup();
        reject(new Error('Timed out while loading the page'));
      }, timeoutMs);

      function cleanup() {
        clearTimeout(timeoutId);
        chrome.tabs.onUpdated.removeListener(listener);
      }

      function listener(updatedTabId, changeInfo) {
        if (updatedTabId === tabId && changeInfo.status === 'complete') {
          cleanup();
          resolve();
        }
      }

      chrome.tabs.onUpdated.addListener(listener);
      tabsGet(tabId)
        .then(function (tab) {
          if (tab && tab.status === 'complete') {
            cleanup();
            resolve();
          }
        })
        .catch(function () {});
    });
  }

  function readFieldFromPage(tabId, selectors) {
    return executeScript({
      target: { tabId: tabId },
      func: function (fieldSelectors) {
        function normalizeWhitespace(value) {
          return String(value || '')
            .replace(/\s+/g, ' ')
            .trim();
        }

        function readTitle() {
          var ogTitle = document.querySelector('meta[property="og:title"]');
          if (ogTitle && ogTitle.content) {
            return ogTitle.content.trim();
          }

          return document.title ? document.title.trim() : '';
        }

        function readFaviconUrl() {
          var iconLink = document.querySelector(
            'link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]'
          );

          if (iconLink && iconLink.href) {
            return iconLink.href;
          }

          try {
            return new URL('/favicon.ico', location.origin).href;
          } catch (_error) {
            return '';
          }
        }

        function readNodeValue(node) {
          if (!node) {
            return '';
          }

          if (node.matches && node.matches('input,textarea,select')) {
            return normalizeWhitespace(node.value || node.getAttribute('value') || '');
          }

          var ariaLabel = node.getAttribute && node.getAttribute('aria-label');
          if (ariaLabel) {
            return normalizeWhitespace(ariaLabel);
          }

          var title = node.getAttribute && node.getAttribute('title');
          if (title) {
            return normalizeWhitespace(title);
          }

          var text = typeof node.innerText === 'string' ? node.innerText : node.textContent;
          return normalizeWhitespace(text);
        }

        return {
          pageUrl: location.href,
          title: readTitle(),
          faviconUrl: readFaviconUrl(),
          fields: fieldSelectors.map(function (field) {
            var node = document.querySelector(field.selector);
            if (!node) {
              throw new Error('Selector not found: ' + field.selector);
            }

            return {
              id: field.id,
              label: field.label,
              selector: field.selector,
              valueText: readNodeValue(node),
            };
          }),
        };
      },
      args: [selectors],
    }).then(function (results) {
      if (!results || !results.length || !results[0].result) {
        throw new Error('No extraction result returned');
      }

      return results[0].result;
    });
  }

  async function findMatchingTab(pageUrl) {
    var tabs = await tabsQuery({});
    return tabs
      .filter(function (tab) {
        return tab && tab.id !== undefined && typeof tab.url === 'string';
      })
      .sort(function (left, right) {
        return Number(Boolean(right.active)) - Number(Boolean(left.active));
      })
      .find(function (tab) {
        return isCompatibleTabUrl(pageUrl, tab.url);
      });
  }

  async function reloadEntryPage(entry) {
    var tab = await findMatchingTab(entry.pageUrl);
    if (!tab || tab.id === undefined) {
      return {
        id: entry.id,
        ok: false,
        skipped: true,
        error: 'Page is not open',
      };
    }

    await tabsReload(tab.id);
    await waitForTabComplete(tab.id, REFRESH_TIMEOUT_MS);
    return {
      id: entry.id,
      ok: true,
    };
  }

  async function captureEntrySnapshot(entry) {
    var existingTab = await findMatchingTab(entry.pageUrl);
    var tab = existingTab;
    var createdTabId = null;

    try {
      if (!tab) {
        tab = await tabsCreate({
          url: entry.pageUrl,
          active: false,
        });
        createdTabId = tab.id;
        await waitForTabComplete(tab.id, REFRESH_TIMEOUT_MS);
      }

      var extracted = await readFieldFromPage(tab.id, entry.fields);
      return {
        pageUrl: extracted.pageUrl || entry.pageUrl,
        title: extracted.title || entry.title,
        faviconUrl: extracted.faviconUrl || entry.faviconUrl,
        fields: extracted.fields || entry.fields,
      };
    } finally {
      if (createdTabId !== null) {
        try {
          await tabsRemove(createdTabId);
        } catch (_error) {}
      }
    }
  }

  async function savePickerResult(session, result) {
    var entries = await AIUsageStorage.loadEntries();
    var now = new Date().toISOString();
    var entryId = session.entryId || AIUsageStorage.generateId();
    var existingIndex = entries.findIndex(function (entry) {
      return entry.id === entryId;
    });
    var existingEntry = existingIndex >= 0 ? entries[existingIndex] : null;
    var titleFromSession = AIUsageStorage.clampText(session.customTitle || '', AIUsageStorage.MAX_TITLE_LENGTH);
    var normalizedFields = AIUsageStorage.normalizeFields(result.fields);

    if (!normalizedFields.length) {
      throw new Error('No fields selected');
    }

    var updatedEntry = {
      id: entryId,
      pageUrl: result.pageUrl,
      title: existingEntry ? existingEntry.title : titleFromSession || result.title || AIUsageStorage.deriveTitleFromUrl(result.pageUrl),
      faviconUrl: result.faviconUrl || AIUsageStorage.defaultFaviconUrl(result.pageUrl),
      order: existingEntry ? existingEntry.order : entries.length,
      fields: normalizedFields,
      updatedAt: now,
    };

    if (existingIndex >= 0) {
      entries[existingIndex] = Object.assign({}, existingEntry, {
        pageUrl: updatedEntry.pageUrl,
        title: titleFromSession || existingEntry.title,
        faviconUrl: updatedEntry.faviconUrl,
        fields: updatedEntry.fields,
        updatedAt: updatedEntry.updatedAt,
      });
    } else {
      entries.push(updatedEntry);
    }

    var savedEntries = await AIUsageStorage.saveEntries(entries);
    return (
      savedEntries.find(function (entry) {
        return entry.id === entryId;
      }) || updatedEntry
    );
  }

  async function handlePickerStart(message, sendResponse) {
    var pageUrl = AIUsageStorage.normalizeHttpUrl(message.url);
    if (!pageUrl) {
      sendResponse({ ok: false, error: 'Invalid URL' });
      return;
    }

    var tab = null;
    try {
      tab = await tabsCreate({
        url: pageUrl,
        active: false,
      });

      pendingPickerSessions.set(tab.id, {
        sendResponse: sendResponse,
        entryId: typeof message.entryId === 'string' && message.entryId.trim() ? message.entryId.trim() : null,
        customTitle: typeof message.title === 'string' ? message.title : '',
        pageUrl: pageUrl,
        tabId: tab.id,
      });

      await waitForTabComplete(tab.id, PICKER_TAB_LOAD_TIMEOUT_MS);
      await executeScript({
        target: { tabId: tab.id },
        files: ['content/picker.js'],
      });
    } catch (error) {
      if (tab && tab.id !== undefined) {
        pendingPickerSessions.delete(tab.id);
        try {
          await tabsRemove(tab.id);
        } catch (_closeError) {}
      }
      sendResponse({ ok: false, error: formatError(error) });
    }
  }

  async function handlePickerResponse(message, sender) {
    var tabId = sender && sender.tab ? sender.tab.id : null;
    if (tabId === null || !pendingPickerSessions.has(tabId)) {
      return;
    }

    var session = pendingPickerSessions.get(tabId);
    pendingPickerSessions.delete(tabId);

    try {
      if (message && message.ok === false) {
        try {
          await tabsRemove(tabId);
        } catch (_error) {}

        session.sendResponse({ ok: false, error: message.error || 'Selection cancelled' });
        return;
      }

      var entry = await savePickerResult(session, {
        pageUrl: message.pageUrl || session.pageUrl,
        title: message.title || '',
        faviconUrl: message.faviconUrl || '',
        fields: message.fields || [],
      });

      try {
        await tabsRemove(tabId);
      } catch (_error) {}

      session.sendResponse({
        ok: true,
        entry: entry,
      });
    } catch (error) {
      session.sendResponse({ ok: false, error: formatError(error) });
    }
  }

  async function handleEntriesGet(sendResponse) {
    try {
      var entries = await AIUsageStorage.loadEntries();
      sendResponse({ ok: true, entries: entries });
    } catch (error) {
      sendResponse({ ok: false, error: formatError(error) });
    }
  }

  async function handleEntriesSave(message, sendResponse) {
    try {
      var savedEntries = await AIUsageStorage.saveEntries(message.entries || []);
      sendResponse({ ok: true, entries: savedEntries });
    } catch (error) {
      sendResponse({ ok: false, error: formatError(error) });
    }
  }

  async function handleRefreshEntry(message, sendResponse) {
    try {
      var entries = await AIUsageStorage.loadEntries();
      var entry = entries.find(function (item) {
        return item.id === message.id;
      });

      if (!entry) {
        sendResponse({
          type: 'REFRESH_ENTRY_RESULT',
          id: message.id,
          ok: false,
          error: 'Entry not found',
        });
        return;
      }

      var snapshot = await captureEntrySnapshot(entry);
      var updatedAt = new Date().toISOString();
      var nextEntries = entries.map(function (item) {
        if (item.id !== entry.id) {
          return item;
        }

        return Object.assign({}, item, {
          pageUrl: snapshot.pageUrl || item.pageUrl,
          faviconUrl: snapshot.faviconUrl || item.faviconUrl,
          fields: snapshot.fields || item.fields,
          updatedAt: updatedAt,
        });
      });

      await AIUsageStorage.saveEntries(nextEntries);

      sendResponse({
        type: 'REFRESH_ENTRY_RESULT',
        id: entry.id,
        ok: true,
        fields: snapshot.fields,
        updatedAt: updatedAt,
      });
    } catch (error) {
      sendResponse({
        type: 'REFRESH_ENTRY_RESULT',
        id: message.id,
        ok: false,
        error: formatError(error),
      });
    }
  }

  async function handleReloadOpenPages(sendResponse) {
    sendResponse({
      ok: true,
    });

    try {
      var entries = await AIUsageStorage.loadEntries();
      for (var index = 0; index < entries.length; index += 1) {
        await reloadEntryPage(entries[index]);
      }
    } catch (_error) {}
  }

  chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (!message || typeof message.type !== 'string') {
      return false;
    }

    if (message.type === 'PICKER_START') {
      handlePickerStart(message, sendResponse);
      return true;
    }

    if (message.type === 'PICKER_RESULT') {
      handlePickerResponse(message, sender);
      return true;
    }

    if (message.type === 'PICKER_CANCEL') {
      handlePickerResponse({ ok: false, error: 'Selection cancelled' }, sender);
      return true;
    }

    if (message.type === 'ENTRIES_GET') {
      handleEntriesGet(sendResponse);
      return true;
    }

    if (message.type === 'ENTRIES_SAVE') {
      handleEntriesSave(message, sendResponse);
      return true;
    }

    if (message.type === 'REFRESH_ENTRY') {
      handleRefreshEntry(message, sendResponse);
      return true;
    }

    if (message.type === 'RELOAD_OPEN_PAGES') {
      handleReloadOpenPages(sendResponse);
      return true;
    }

    return false;
  });
})();
