importScripts('storage.js');

(function () {
  'use strict';

  var pendingPickerSessions = new Map();
  var PICKER_TAB_LOAD_TIMEOUT_MS = 25000;
  var REFRESH_TIMEOUT_MS = 25000;
  var REFRESH_READ_RETRY_INTERVAL_MS = 400;
  var REFRESH_READ_RETRY_MAX_MS = 20000;
  /** Cap parallel tab lifecycles during refresh-all (one concurrent run per distinct URL group). */
  var REFRESH_ALL_MAX_CONCURRENT_URL_GROUPS = 5;

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

  function tabsUpdate(tabId, updateProperties) {
    return callbackToPromise(function (resolve) {
      chrome.tabs.update(tabId, updateProperties, resolve);
    });
  }

  function tabsRemove(tabId) {
    return callbackToPromise(function (resolve) {
      chrome.tabs.remove(tabId, resolve);
    });
  }

  function tabsReload(tabId, reloadProperties) {
    return callbackToPromise(function (resolve) {
      chrome.tabs.reload(tabId, reloadProperties || {}, resolve);
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

  function isCompatibleTabUrl(pinUrl, tabUrl) {
    try {
      var pin = new URL(pinUrl);
      var tab = new URL(tabUrl);

      if (pin.origin !== tab.origin) {
        return false;
      }

      var pinPath = normalizePath(pin.pathname);
      var tabPath = normalizePath(tab.pathname);

      return (
        tabPath === pinPath ||
        tabPath.indexOf(pinPath + '/') === 0 ||
        pinPath.indexOf(tabPath + '/') === 0
      );
    } catch (_error) {
      return false;
    }
  }

  /**
   * Wait until the tab has finished loading a real http(s) document.
   * Chrome may report status "complete" for about:blank before the requested URL loads;
   * we only resolve when tabs.get shows status "complete" and a normal http(s) tab URL.
   * When waitOptions.expectedPageUrl is set (refresh flow), also require no pendingUrl,
   * a non-discarded tab, and URL compatibility with the pin's page URL.
   */
  function waitForTabComplete(tabId, timeoutMs, waitOptions) {
    var expectedNorm = null;
    if (
      waitOptions &&
      typeof waitOptions.expectedPageUrl === 'string' &&
      waitOptions.expectedPageUrl.trim()
    ) {
      expectedNorm = AIUsageStorage.normalizeHttpUrl(waitOptions.expectedPageUrl);
    }

    return new Promise(function (resolve, reject) {
      var settled = false;
      var timeoutId = setTimeout(function () {
        if (settled) {
          return;
        }

        settled = true;
        chrome.tabs.onUpdated.removeListener(listener);
        reject(new Error('Timed out while loading the page'));
      }, timeoutMs);

      function finish() {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timeoutId);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }

      function isTabReadyForWait(tab) {
        if (!tab || tab.status !== 'complete') {
          return false;
        }

        if (tab.discarded) {
          return false;
        }

        var pending = tab.pendingUrl;
        if (pending != null && String(pending).trim() !== '') {
          return false;
        }

        var url = tab.url || '';
        if (!AIUsageStorage.isHttpUrl(url)) {
          return false;
        }

        if (expectedNorm && !isCompatibleTabUrl(expectedNorm, url)) {
          return false;
        }

        return true;
      }

      function tryFinishIfReady() {
        if (settled) {
          return;
        }

        tabsGet(tabId)
          .then(function (tab) {
            if (!isTabReadyForWait(tab)) {
              return;
            }

            finish();
          })
          .catch(function () {});
      }

      function listener(updatedTabId, changeInfo) {
        if (updatedTabId !== tabId || changeInfo.status !== 'complete') {
          return;
        }

        tryFinishIfReady();
      }

      chrome.tabs.onUpdated.addListener(listener);
      tryFinishIfReady();
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

  async function getPickerTargetTab(message) {
    if (Number.isInteger(message.tabId)) {
      var existingTab = await tabsGet(message.tabId);
      if (!existingTab || !AIUsageStorage.isHttpUrl(existingTab.url || '')) {
        throw new Error('Pin capture works only on http or https pages');
      }

      await tabsUpdate(existingTab.id, { active: true });
      return tabsGet(existingTab.id);
    }

    var pageUrl = AIUsageStorage.normalizeHttpUrl(message.url);
    if (!pageUrl) {
      throw new Error('Invalid source page');
    }

    var matchingTab = await findMatchingTab(pageUrl);
    if (matchingTab && matchingTab.id !== undefined) {
      await tabsUpdate(matchingTab.id, { active: true });
      return tabsGet(matchingTab.id);
    }

    return tabsCreate({
      url: pageUrl,
      active: true,
    });
  }

  async function readPinFromPage(tabId, pin) {
    var selector = pin.selector;

    if (!selector) {
      throw new Error('Pin selector is missing');
    }

    return executeScript({
      target: { tabId: tabId },
      func: function (pinSelector) {
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

        var node = document.querySelector(pinSelector);
        if (!node) {
          throw new Error('Saved source could not be matched on this page');
        }

        var valueText = readNodeValue(node);
        if (!/[A-Za-z0-9]/.test(valueText)) {
          throw new Error('Saved source no longer contains meaningful text');
        }

        return {
          pageUrl: location.href,
          pageTitle: readTitle(),
          faviconUrl: readFaviconUrl(),
          field: {
            selector: pinSelector,
            valueText: valueText,
          },
        };
      },
      args: [selector],
    }).then(function (results) {
      if (!results || !results.length || !results[0].result) {
        throw new Error('No refresh result returned');
      }

      return results[0].result;
    });
  }

  function isRetriableRefreshReadError(message) {
    if (!message || typeof message !== 'string') {
      return false;
    }

    return (
      message.indexOf('could not be matched') !== -1 ||
      message.indexOf('meaningful text') !== -1 ||
      message.indexOf('No refresh result') !== -1
    );
  }

  function delay(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  async function readPinFromPageWithRetries(tabId, pin) {
    var deadline = Date.now() + REFRESH_READ_RETRY_MAX_MS;
    var lastError = null;

    while (Date.now() < deadline) {
      try {
        return await readPinFromPage(tabId, pin);
      } catch (error) {
        lastError = error;
        var msg = formatError(error);
        if (!isRetriableRefreshReadError(msg)) {
          throw error;
        }

        await delay(REFRESH_READ_RETRY_INTERVAL_MS);
      }
    }

    throw lastError || new Error('Refresh timed out while waiting for page content');
  }

  /**
   * Find or create a tab for the pin URL, reload with cache bypass, wait until ready.
   * @returns {{ tabId: number, createdTabId: number | null }}
   */
  async function ensureRefreshedTabForUrl(pageUrlNorm, pageUrlForTab) {
    var waitOpts = { expectedPageUrl: pageUrlNorm };
    var existingTab = await findMatchingTab(pageUrlForTab);
    var tab = existingTab;
    var createdTabId = null;

    if (!tab) {
      tab = await tabsCreate({
        url: pageUrlForTab,
        active: false,
      });
      createdTabId = tab.id;
      try {
        await waitForTabComplete(tab.id, REFRESH_TIMEOUT_MS, waitOpts);
        await tabsReload(tab.id, { bypassCache: true });
        await waitForTabComplete(tab.id, REFRESH_TIMEOUT_MS, waitOpts);
      } catch (error) {
        try {
          await tabsRemove(createdTabId);
        } catch (_removeError) {}
        throw error;
      }
      return { tabId: tab.id, createdTabId: createdTabId };
    }

    await tabsReload(tab.id, { bypassCache: true });
    await waitForTabComplete(tab.id, REFRESH_TIMEOUT_MS, waitOpts);
    return { tabId: tab.id, createdTabId: null };
  }

  async function capturePinSnapshot(pin) {
    var pageUrlNorm = AIUsageStorage.normalizeHttpUrl(pin.pageUrl);
    if (!pageUrlNorm) {
      throw new Error('Stored source URL is invalid');
    }

    var createdTabId = null;
    try {
      var ensured = await ensureRefreshedTabForUrl(pageUrlNorm, pin.pageUrl);
      createdTabId = ensured.createdTabId;
      return await readPinFromPageWithRetries(ensured.tabId, pin);
    } finally {
      if (createdTabId !== null) {
        try {
          await tabsRemove(createdTabId);
        } catch (_error) {}
      }
    }
  }

  /**
   * Refresh every pin that shares the same normalized URL using one tab load.
   * @returns {Array<{ id: string, ok: boolean, pin?: object, error?: string }>}
   */
  async function refreshPinsSharingUrl(pageUrlNorm, groupPins) {
    var results = [];
    var createdTabId = null;

    try {
      var ensured = await ensureRefreshedTabForUrl(pageUrlNorm, groupPins[0].pageUrl);
      createdTabId = ensured.createdTabId;
      var tabId = ensured.tabId;

      for (var i = 0; i < groupPins.length; i += 1) {
        var pin = groupPins[i];
        try {
          var snapshot = await readPinFromPageWithRetries(tabId, pin);
          var updatedPin = AIUsageStorage.buildPinFromCapture({
            existingPin: pin,
            capture: snapshot,
            titleHint: pin.title,
            order: pin.order,
          });

          if (!updatedPin) {
            throw new Error('Saved source could not be refreshed');
          }

          results.push({
            id: pin.id,
            ok: true,
            pin: updatedPin,
          });
        } catch (error) {
          results.push({
            id: pin.id,
            ok: false,
            error: formatError(error),
          });
        }
      }
    } catch (error) {
      var msg = formatError(error);
      for (var j = 0; j < groupPins.length; j += 1) {
        results.push({
          id: groupPins[j].id,
          ok: false,
          error: msg,
        });
      }
    } finally {
      if (createdTabId !== null) {
        try {
          await tabsRemove(createdTabId);
        } catch (_error) {}
      }
    }

    return results;
  }

  async function handlePickerStart(message, sendResponse) {
    try {
      var tab = await getPickerTargetTab(message);
      if (!tab || tab.id === undefined) {
        throw new Error('Could not open the source page');
      }

      pendingPickerSessions.set(tab.id, {
        pinId:
          typeof message.pinId === 'string' && message.pinId.trim()
            ? message.pinId.trim()
            : null,
        titleHint: typeof message.title === 'string' ? message.title : '',
      });

      await waitForTabComplete(tab.id, PICKER_TAB_LOAD_TIMEOUT_MS);
      await executeScript({
        target: { tabId: tab.id },
        files: ['content/picker.js'],
      });

      sendResponse({
        ok: true,
        started: true,
        tabId: tab.id,
      });
    } catch (error) {
      sendResponse({
        ok: false,
        error: formatError(error),
      });
    }
  }

  async function handlePickerSavePin(message, sender, sendResponse) {
    var tabId = sender && sender.tab ? sender.tab.id : null;
    if (tabId === null || !pendingPickerSessions.has(tabId)) {
      sendResponse({ ok: false, error: 'No active pin session' });
      return;
    }

    try {
      var session = pendingPickerSessions.get(tabId);
      var pins = await AIUsageStorage.loadPins();
      var existingPin = session.pinId
        ? pins.find(function (pin) {
            return pin.id === session.pinId;
          })
        : null;
      var pin = AIUsageStorage.buildPinFromCapture({
        existingPin: existingPin,
        capture: {
          pageUrl: message.pageUrl,
          pageTitle: message.pageTitle,
          faviconUrl: message.faviconUrl,
          field: message.field || {},
        },
        titleHint: session.titleHint,
        order: existingPin ? existingPin.order : pins.length,
      });

      if (!pin) {
        throw new Error('Choose visible text that can be saved as a pin');
      }

      var nextPins = existingPin
        ? pins.map(function (item) {
            return item.id === existingPin.id ? pin : item;
          })
        : pins.concat(pin);
      var savedPins = await AIUsageStorage.savePins(nextPins);
      var savedPin = savedPins.find(function (item) {
        return item.id === pin.id;
      });

      if (existingPin) {
        pendingPickerSessions.delete(tabId);
      }

      sendResponse({
        ok: true,
        pin: savedPin || pin,
        sessionComplete: Boolean(existingPin),
      });
    } catch (error) {
      sendResponse({
        ok: false,
        error: formatError(error),
      });
    }
  }

  function handlePickerSessionEnd(sender, sendResponse) {
    var tabId = sender && sender.tab ? sender.tab.id : null;
    if (tabId !== null) {
      pendingPickerSessions.delete(tabId);
    }

    sendResponse({ ok: true });
  }

  function handlePickerCancel(message, sender, sendResponse) {
    var tabId = sender && sender.tab ? sender.tab.id : null;
    if (tabId !== null) {
      pendingPickerSessions.delete(tabId);
    }

    sendResponse({
      ok: false,
      error: message && message.error ? message.error : 'Pin capture cancelled',
    });
  }

  async function handlePinsGet(sendResponse) {
    try {
      var pins = await AIUsageStorage.loadPins();
      sendResponse({ ok: true, pins: pins });
    } catch (error) {
      sendResponse({ ok: false, error: formatError(error) });
    }
  }

  async function handlePinsSave(message, sendResponse) {
    try {
      var savedPins = await AIUsageStorage.savePins(message.pins || []);
      sendResponse({ ok: true, pins: savedPins });
    } catch (error) {
      sendResponse({ ok: false, error: formatError(error) });
    }
  }

  async function handleRefreshPin(message, sendResponse) {
    try {
      var pins = await AIUsageStorage.loadPins();
      var pin = pins.find(function (item) {
        return item.id === message.id;
      });

      if (!pin) {
        sendResponse({
          type: 'REFRESH_PIN_RESULT',
          id: message.id,
          ok: false,
          error: 'Pin not found',
        });
        return;
      }

      var snapshot = await capturePinSnapshot(pin);
      var updatedPin = AIUsageStorage.buildPinFromCapture({
        existingPin: pin,
        capture: snapshot,
        titleHint: pin.title,
        order: pin.order,
      });

      if (!updatedPin) {
        throw new Error('Saved source could not be refreshed');
      }

      var savedPins = await AIUsageStorage.savePins(
        pins.map(function (item) {
          return item.id === pin.id ? updatedPin : item;
        })
      );
      var savedPin = savedPins.find(function (item) {
        return item.id === updatedPin.id;
      });

      sendResponse({
        type: 'REFRESH_PIN_RESULT',
        id: pin.id,
        ok: true,
        pin: savedPin || updatedPin,
      });
    } catch (error) {
      sendResponse({
        type: 'REFRESH_PIN_RESULT',
        id: message.id,
        ok: false,
        error: formatError(error),
      });
    }
  }

  async function handleRefreshAllPins(sendResponse) {
    try {
      var pins = await AIUsageStorage.loadPins();
      if (!pins.length) {
        sendResponse({ ok: true, results: [] });
        return;
      }

      var invalidResults = [];
      var groups = new Map();

      for (var i = 0; i < pins.length; i += 1) {
        var pin = pins[i];
        var norm = AIUsageStorage.normalizeHttpUrl(pin.pageUrl);
        if (!norm) {
          invalidResults.push({
            id: pin.id,
            ok: false,
            error: 'Stored source URL is invalid',
          });
          continue;
        }

        if (!groups.has(norm)) {
          groups.set(norm, []);
        }
        groups.get(norm).push(pin);
      }

      var groupEntries = [];
      groups.forEach(function (groupPins, norm) {
        groupEntries.push([norm, groupPins]);
      });

      var groupResultArrays = [];
      for (
        var chunkStart = 0;
        chunkStart < groupEntries.length;
        chunkStart += REFRESH_ALL_MAX_CONCURRENT_URL_GROUPS
      ) {
        var chunk = groupEntries.slice(
          chunkStart,
          chunkStart + REFRESH_ALL_MAX_CONCURRENT_URL_GROUPS
        );
        var chunkResults = await Promise.all(
          chunk.map(function (entry) {
            return refreshPinsSharingUrl(entry[0], entry[1]);
          })
        );
        groupResultArrays = groupResultArrays.concat(chunkResults);
      }
      var flat = invalidResults.slice();
      for (var g = 0; g < groupResultArrays.length; g += 1) {
        flat = flat.concat(groupResultArrays[g]);
      }

      var successById = {};
      for (var r = 0; r < flat.length; r += 1) {
        var entry = flat[r];
        if (entry.ok && entry.pin) {
          successById[entry.id] = entry.pin;
        }
      }

      var nextPins = pins.map(function (p) {
        if (successById[p.id]) {
          return successById[p.id];
        }
        return p;
      });

      await AIUsageStorage.savePins(nextPins);

      var savedPins = await AIUsageStorage.loadPins();
      var savedById = {};
      for (var s = 0; s < savedPins.length; s += 1) {
        savedById[savedPins[s].id] = savedPins[s];
      }

      var results = flat.map(function (item) {
        if (item.ok && item.pin) {
          return {
            id: item.id,
            ok: true,
            pin: savedById[item.id] || item.pin,
          };
        }
        return {
          id: item.id,
          ok: false,
          error: item.error,
        };
      });

      sendResponse({
        ok: true,
        results: results,
      });
    } catch (error) {
      sendResponse({
        ok: false,
        error: formatError(error),
      });
    }
  }

  async function handleOpenPinSource(message, sendResponse) {
    try {
      var pageUrl = AIUsageStorage.normalizeHttpUrl(message.url);
      if (!pageUrl) {
        throw new Error('Stored source URL is invalid');
      }

      await tabsCreate({
        url: pageUrl,
        active: true,
      });

      sendResponse({ ok: true });
    } catch (error) {
      sendResponse({ ok: false, error: formatError(error) });
    }
  }

  async function handleReloadOpenPages(sendResponse) {
    sendResponse({ ok: true });

    try {
      var pins = await AIUsageStorage.loadPins();
      var seenTabIds = new Set();

      for (var index = 0; index < pins.length; index += 1) {
        var tab = await findMatchingTab(pins[index].pageUrl);
        if (!tab || tab.id === undefined || seenTabIds.has(tab.id)) {
          continue;
        }

        seenTabIds.add(tab.id);
        await tabsReload(tab.id);
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

    if (message.type === 'PICKER_SAVE_PIN') {
      handlePickerSavePin(message, sender, sendResponse);
      return true;
    }

    if (message.type === 'PICKER_SESSION_END') {
      handlePickerSessionEnd(sender, sendResponse);
      return true;
    }

    if (message.type === 'PICKER_CANCEL') {
      handlePickerCancel(message, sender, sendResponse);
      return true;
    }

    if (message.type === 'PINS_GET') {
      handlePinsGet(sendResponse);
      return true;
    }

    if (message.type === 'PINS_SAVE') {
      handlePinsSave(message, sendResponse);
      return true;
    }

    if (message.type === 'REFRESH_PIN') {
      handleRefreshPin(message, sendResponse);
      return true;
    }

    if (message.type === 'REFRESH_ALL_PINS') {
      handleRefreshAllPins(sendResponse);
      return true;
    }

    if (message.type === 'OPEN_PIN_SOURCE') {
      handleOpenPinSource(message, sendResponse);
      return true;
    }

    if (message.type === 'RELOAD_OPEN_PAGES') {
      handleReloadOpenPages(sendResponse);
      return true;
    }

    return false;
  });
})();
