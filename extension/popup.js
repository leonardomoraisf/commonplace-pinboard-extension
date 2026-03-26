(function () {
  'use strict';

  if (!window.AIUsageStorage) {
    return;
  }

  var VIEW_LAYOUT_STORAGE_KEY = 'pinboardViewLayout';

  var state = {
    pins: [],
    activeTab: null,
    editingTitleId: null,
    openMenuPinId: null,
    repinPinId: null,
    sortableInstances: [],
    viewLayout: 'grouped',
    busy: false,
  };

  var dom = {};

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

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

  function sendMessage(payload) {
    return callbackToPromise(function (resolve) {
      chrome.runtime.sendMessage(payload, resolve);
    });
  }

  function tabsQuery(queryInfo) {
    return callbackToPromise(function (resolve) {
      chrome.tabs.query(queryInfo, resolve);
    });
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

  function getHostname(value) {
    try {
      return new URL(value).hostname.replace(/^www\./, '');
    } catch (_error) {
      return value || 'Unknown page';
    }
  }

  function normalizeViewLayout(value) {
    return value === 'flat' ? 'flat' : 'grouped';
  }

  function groupPinsForDisplay(pins) {
    var byHost = new Map();
    pins.forEach(function (pin) {
      var host = getHostname(pin.pageUrl);
      if (!byHost.has(host)) {
        byHost.set(host, []);
      }
      byHost.get(host).push(pin);
    });

    var groups = [];
    byHost.forEach(function (list, host) {
      list.sort(function (left, right) {
        return left.order - right.order;
      });
      var minOrder = list.reduce(function (acc, pin) {
        return Math.min(acc, pin.order);
      }, list[0].order);
      groups.push({ host: host, pins: list, minOrder: minOrder });
    });

    groups.sort(function (left, right) {
      if (left.minOrder !== right.minOrder) {
        return left.minOrder - right.minOrder;
      }
      return left.host.localeCompare(right.host);
    });

    return groups;
  }

  function buildPinCardHtml(pin, index) {
    var isEditing = state.editingTitleId === pin.id;
    var isMenuOpen = state.openMenuPinId === pin.id;
    var faviconMarkup = pin.faviconUrl
      ? '<img src="' +
        escapeHtml(pin.faviconUrl) +
        '" alt="" referrerpolicy="no-referrer" loading="lazy" />'
      : '<span>' +
        escapeHtml((pin.title || '?').trim().charAt(0).toUpperCase() || '?') +
        '</span>';
    var titleMarkup = isEditing
      ? '<input class="pin-card__title-input" type="text" maxlength="' +
        String(AIUsageStorage.MAX_TITLE_LENGTH) +
        '" value="' +
        escapeHtml(pin.title) +
        '" />'
      : '<button class="pin-card__title-button" type="button" data-action="edit-title" aria-label="Rename pin">' +
        escapeHtml(pin.title) +
        '</button>';
    var editMarkup =
      '<div class="pin-card__edit-actions">' +
      '<button class="pin-action pin-action--accent" type="button" data-action="save-title">Save</button>' +
      '<button class="pin-action" type="button" data-action="cancel-title">Cancel</button>' +
      '</div>';
    var menuMarkup =
      '<div class="pin-card__menu">' +
      '<button class="pin-card__menu-toggle" type="button" data-action="toggle-menu" aria-label="Open pin actions" aria-expanded="' +
      String(isMenuOpen) +
      '">•••</button>' +
      '<div class="pin-card__actions' +
      (isMenuOpen ? ' pin-card__actions--open' : '') +
      '">' +
      '<button class="pin-action" type="button" data-action="refresh">Refresh</button>' +
      '<button class="pin-action" type="button" data-action="repin">Re-pin</button>' +
      '<button class="pin-action" type="button" data-action="open">Open</button>' +
      '<button class="pin-action pin-action--danger" type="button" data-action="remove">Remove</button>' +
      '</div>' +
      '</div>';
    var statusMarkup = pin.syncError
      ? '<span class="pin-card__status pin-card__status--error">Needs re-pin</span>'
      : '<span class="pin-card__status">Saved snapshot</span>';
    var errorMarkup = pin.syncError
      ? '<div class="pin-card__error">' + escapeHtml(pin.syncError) + '</div>'
      : '';

    return (
      '<article class="pin-card' +
      (isMenuOpen ? ' pin-card--menu-open' : '') +
      '" role="listitem" data-pin-id="' +
      escapeHtml(pin.id) +
      '" style="--pin-order:' +
      index +
      ';">' +
      '<div class="pin-card__top">' +
      '<button class="pin-handle" type="button" data-action="drag" aria-label="Drag to reorder">::</button>' +
      '<div class="pin-card__favicon">' +
      faviconMarkup +
      '</div>' +
      '<div class="pin-card__info">' +
      titleMarkup +
      (isEditing ? editMarkup : '') +
      '<div class="pin-card__meta">' +
      '<span class="pin-card__meta-item">' +
      escapeHtml(getHostname(pin.pageUrl)) +
      '</span>' +
      '<span class="pin-card__meta-item">' +
      statusMarkup +
      '</span>' +
      '</div>' +
      '<div class="pin-card__preview">' +
      escapeHtml(pin.previewText || pin.savedContent) +
      '</div>' +
      '</div>' +
      (isEditing ? '' : '<div class="pin-card__toolbar">' + menuMarkup + '</div>') +
      '</div>' +
      errorMarkup +
      '<div class="pin-card__snapshot">' +
      '<details class="pin-card__details">' +
      '<summary>Full saved snapshot</summary>' +
      '<pre class="pin-card__saved-content">' + escapeHtml(pin.savedContent) + '</pre>' +
      '</details>' +
      '</div>' +
      '<div class="pin-card__timestamp">' +
      '<span title="' + escapeHtml(formatExactTime(pin.createdAt)) + '">Captured ' + escapeHtml(formatRelativeTime(pin.createdAt)) + '</span>' +
      '<span title="' + escapeHtml(formatExactTime(pin.updatedAt)) + '">Updated ' + escapeHtml(formatRelativeTime(pin.updatedAt)) + '</span>' +
      '</div>' +
      '</article>'
    );
  }

  function formatRelativeTime(value) {
    if (!value) {
      return 'Not refreshed yet';
    }

    var timestamp = new Date(value);
    if (Number.isNaN(timestamp.getTime())) {
      return 'Not refreshed yet';
    }

    var seconds = Math.round((Date.now() - timestamp.getTime()) / 1000);
    if (seconds < 30) {
      return 'Moments ago';
    }

    var units = [
      ['day', 86400],
      ['hour', 3600],
      ['minute', 60],
    ];

    for (var index = 0; index < units.length; index += 1) {
      var unit = units[index];
      if (seconds >= unit[1]) {
        var amount = Math.round(seconds / unit[1]);
        return amount + ' ' + unit[0] + (amount === 1 ? '' : 's') + ' ago';
      }
    }

    return 'Moments ago';
  }

  function formatExactTime(value) {
    if (!value) {
      return '';
    }

    var date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return date.toLocaleString([], {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }

  function getPin(pinId) {
    return state.pins.find(function (pin) {
      return pin.id === pinId;
    });
  }

  function getEditingInput(pinId) {
    var selector = '[data-pin-id="' + CSS.escape(pinId) + '"] .pin-card__title-input';
    return dom.pinList.querySelector(selector);
  }

  function updateStatus(text, kind) {
    dom.statusBanner.textContent = text;
    dom.statusBanner.setAttribute('data-kind', kind || 'idle');
  }

  function updateHero() {
    dom.pinCount.textContent = String(state.pins.length);

    if (state.activeTab && AIUsageStorage.isHttpUrl(state.activeTab.url || '')) {
      dom.currentTabHost.textContent = getHostname(state.activeTab.url);
    } else {
      dom.currentTabHost.textContent = 'Unavailable';
    }
  }

  function updateBoardSummary() {
    if (!state.pins.length) {
      dom.boardSummary.textContent = 'Pins stay readable from any tab.';
      return;
    }

    dom.boardSummary.textContent =
      state.pins.length === 1
        ? '1 saved pin in your manual order.'
        : state.pins.length + ' saved pins in your manual order.';
  }

  function updateCapturePanel() {
    var repinPin = state.repinPinId ? getPin(state.repinPinId) : null;
    var activeTabSupported =
      state.activeTab && AIUsageStorage.isHttpUrl((state.activeTab && state.activeTab.url) || '');
    var canCaptureFromTab = Boolean(activeTabSupported);

    if (repinPin) {
      var canUseCurrentTab =
        activeTabSupported && isCompatibleTabUrl(repinPin.pageUrl, state.activeTab.url || '');

      dom.captureHeading.textContent = canUseCurrentTab ? 'Re-pin From This Tab' : 'Re-pin From Source';
      dom.captureModeBadge.textContent = canUseCurrentTab ? 'Current page' : 'Source page';
      dom.captureHelp.textContent = canUseCurrentTab
        ? 'The current tab matches this pin. Open the picker, click the updated content, and save the replacement snapshot.'
        : 'The current tab does not match this pin. Commonplace will open the saved source page, start the picker there, and replace the snapshot you choose.';
      dom.captureButton.textContent = canUseCurrentTab ? 'Re-pin From This Tab' : 'Open Source For Re-pin';
      dom.captureCancel.hidden = false;
      dom.captureButton.disabled = state.busy;

      if (!dom.captureTitle.value) {
        dom.captureTitle.value = repinPin.title;
      }

      return;
    }

    dom.captureHeading.textContent = 'Pin From This Tab';
    dom.captureModeBadge.textContent = 'Current page';
    dom.captureHelp.textContent =
      'Open the picker on this tab, click the content you want, name it if needed, and save each snapshot directly into the board.';
    dom.captureButton.textContent = 'Pin From This Tab';
    dom.captureCancel.hidden = true;
    dom.captureButton.disabled = state.busy || !canCaptureFromTab;

    if (!canCaptureFromTab) {
      updateStatus('Open an http or https page to capture a new pin.', 'error');
    }
  }

  function setBusy(isBusy) {
    state.busy = isBusy;
    dom.captureTitle.disabled = isBusy;
    dom.captureButton.disabled =
      isBusy ||
      (!state.repinPinId &&
        !(state.activeTab && AIUsageStorage.isHttpUrl((state.activeTab && state.activeTab.url) || '')));
    dom.captureCancel.disabled = isBusy;
    dom.refreshAll.disabled = isBusy || !state.pins.length;
    if (dom.pinViewLayout) {
      dom.pinViewLayout.disabled = isBusy;
    }

    Array.prototype.forEach.call(dom.pinList.querySelectorAll('button, input'), function (element) {
      if (element.id === 'capture-title') {
        return;
      }

      if (element.classList.contains('pin-card__title-input')) {
        element.disabled = isBusy;
        return;
      }

      if (element.closest('.pin-card')) {
        element.disabled = isBusy;
      }
    });
  }

  function renderEmptyState() {
    dom.pinList.removeAttribute('role');
    dom.pinList.innerHTML =
      '<div class="empty-state" role="note">' +
      '<div class="empty-state__eyebrow">Archive ready</div>' +
      '<h3 class="empty-state__title">No pins yet</h3>' +
      '<p class="empty-state__text">Open any http or https page, capture a useful line, number, or heading, and it will stay here as a saved snapshot you can revisit from every other tab.</p>' +
      '</div>';
  }

  function renderPins() {
    if (!state.pins.length) {
      renderEmptyState();
      updateListInteractions();
      return;
    }

    var orderIndex = 0;

    if (state.viewLayout === 'flat') {
      dom.pinList.setAttribute('role', 'list');
      dom.pinList.innerHTML = state.pins
        .map(function (pin) {
          return buildPinCardHtml(pin, orderIndex++);
        })
        .join('');
    } else {
      dom.pinList.setAttribute('role', 'presentation');
      var groups = groupPinsForDisplay(state.pins);
      dom.pinList.innerHTML = groups
        .map(function (group, groupIndex) {
          var titleId = 'pin-group-title-' + String(groupIndex);
          var cardsHtml = group.pins
            .map(function (pin) {
              return buildPinCardHtml(pin, orderIndex++);
            })
            .join('');
          return (
            '<section class="pin-group" aria-labelledby="' +
            titleId +
            '">' +
            '<h3 class="pin-group__title" id="' +
            titleId +
            '">' +
            escapeHtml(group.host) +
            '</h3>' +
            '<div class="pin-group__list" role="list">' +
            cardsHtml +
            '</div>' +
            '</section>'
          );
        })
        .join('');
    }

    updateListInteractions();
  }

  function syncViewLayoutSelect() {
    if (!dom.pinViewLayout) {
      return;
    }
    dom.pinViewLayout.value = state.viewLayout;
  }

  function render() {
    updateHero();
    updateBoardSummary();
    renderPins();
    syncViewLayoutSelect();
    updateCapturePanel();
    setBusy(state.busy);
  }

  function destroySortableInstances() {
    state.sortableInstances.forEach(function (instance) {
      instance.destroy();
    });
    state.sortableInstances = [];
  }

  function updateListInteractions() {
    destroySortableInstances();

    if (!state.pins.length) {
      return;
    }

    var sortableOptions = {
      animation: 180,
      draggable: '.pin-card',
      handle: '.pin-handle',
      ghostClass: 'is-ghost',
      chosenClass: 'is-chosen',
      dragClass: 'is-dragging',
      onEnd: handleReorder,
    };

    if (state.viewLayout === 'grouped') {
      sortableOptions.group = 'pins';
      Array.prototype.forEach.call(dom.pinList.querySelectorAll('.pin-group__list'), function (
        listEl
      ) {
        state.sortableInstances.push(Sortable.create(listEl, sortableOptions));
      });
    } else {
      state.sortableInstances.push(Sortable.create(dom.pinList, sortableOptions));
    }
  }

  async function loadState() {
    var tabs = await tabsQuery({
      active: true,
      currentWindow: true,
    });

    state.activeTab = tabs && tabs.length ? tabs[0] : null;
    state.pins = await AIUsageStorage.loadPins();

    var storedUi = await callbackToPromise(function (resolve) {
      chrome.storage.local.get([VIEW_LAYOUT_STORAGE_KEY], resolve);
    });
    state.viewLayout = normalizeViewLayout(storedUi[VIEW_LAYOUT_STORAGE_KEY]);
  }

  async function persistPins(nextPins, statusText) {
    var syncErrorsById = state.pins.reduce(function (accumulator, pin) {
      if (pin.syncError) {
        accumulator[pin.id] = pin.syncError;
      }

      return accumulator;
    }, {});
    var savedPins = await AIUsageStorage.savePins(nextPins);
    state.pins = savedPins.map(function (pin) {
      return syncErrorsById[pin.id]
        ? Object.assign({}, pin, { syncError: syncErrorsById[pin.id] })
        : pin;
    });
    render();
    if (statusText) {
      updateStatus(statusText, 'success');
    }
  }

  async function handleReorder() {
    var pinIds = Array.prototype.slice
      .call(dom.pinList.querySelectorAll('.pin-card'))
      .map(function (card) {
        return card.getAttribute('data-pin-id');
      });

    var nextPins = pinIds
      .map(function (pinId, index) {
        var pin = getPin(pinId);
        if (!pin) {
          return null;
        }

        return Object.assign({}, pin, { order: index });
      })
      .filter(Boolean);

    await persistPins(nextPins, 'Pin order saved.');
  }

  function beginTitleEdit(pinId) {
    state.editingTitleId = pinId;
    state.openMenuPinId = null;
    render();

    var input = getEditingInput(pinId);
    if (input) {
      input.focus();
      input.select();
    }
  }

  function cancelTitleEdit() {
    state.editingTitleId = null;
    render();
  }

  function setPinMenuOpen(pinId, isOpen) {
    var card = dom.pinList.querySelector('[data-pin-id="' + CSS.escape(pinId) + '"]');
    if (!card) {
      return;
    }
    var toggle = card.querySelector('.pin-card__menu-toggle');
    var actions = card.querySelector('.pin-card__actions');
    if (isOpen) {
      card.classList.add('pin-card--menu-open');
      if (toggle) {
        toggle.setAttribute('aria-expanded', 'true');
      }
      if (actions) {
        actions.classList.add('pin-card__actions--open');
      }
    } else {
      card.classList.remove('pin-card--menu-open');
      if (toggle) {
        toggle.setAttribute('aria-expanded', 'false');
      }
      if (actions) {
        actions.classList.remove('pin-card__actions--open');
      }
    }
  }

  function togglePinMenu(pinId) {
    var prev = state.openMenuPinId;
    var next = prev === pinId ? null : pinId;
    state.openMenuPinId = next;

    if (prev && prev !== next) {
      setPinMenuOpen(prev, false);
    }
    if (next) {
      setPinMenuOpen(next, true);
    }
  }

  function closePinMenu() {
    var pinId = state.openMenuPinId;
    if (!pinId) {
      return;
    }
    state.openMenuPinId = null;
    setPinMenuOpen(pinId, false);
  }

  async function saveTitle(pinId) {
    var input = getEditingInput(pinId);
    if (!input) {
      state.editingTitleId = null;
      render();
      return;
    }

    var nextTitle = AIUsageStorage.clampText(input.value, AIUsageStorage.MAX_TITLE_LENGTH);
    if (!nextTitle) {
      updateStatus('Pin title cannot be empty.', 'error');
      input.focus();
      return;
    }

    state.editingTitleId = null;

    await persistPins(
      state.pins.map(function (pin) {
        return pin.id === pinId ? Object.assign({}, pin, { title: nextTitle }) : pin;
      }),
      'Pin title saved.'
    );
  }

  async function removePin(pinId) {
    var pin = getPin(pinId);
    if (!pin) {
      return;
    }

    if (!window.confirm('Remove "' + pin.title + '"?')) {
      return;
    }

    if (state.repinPinId === pinId) {
      state.repinPinId = null;
      dom.captureTitle.value = '';
    }

    await persistPins(AIUsageStorage.removePin(state.pins, pinId), 'Pin removed.');
  }

  function beginRepin(pinId) {
    var pin = getPin(pinId);
    if (!pin) {
      return;
    }

    state.repinPinId = pinId;
    state.editingTitleId = null;
    dom.captureTitle.value = pin.title;
    render();
    dom.captureTitle.focus();
    dom.captureTitle.select();
    updateStatus('Re-pin mode ready. Start from the current tab or the saved source page.', 'idle');
  }

  function cancelRepin() {
    state.repinPinId = null;
    dom.captureTitle.value = '';
    render();
    updateStatus('Re-pin cancelled.', 'idle');
  }

  async function refreshPin(pinId) {
    var response = await sendMessage({
      type: 'REFRESH_PIN',
      id: pinId,
    });

    if (!response || !response.ok || !response.pin) {
      throw new Error((response && response.error) || 'Refresh failed');
    }

    state.pins = state.pins.map(function (pin) {
      return pin.id === pinId ? response.pin : pin;
    });
    render();
  }

  async function refreshAllPins() {
    if (!state.pins.length) {
      updateStatus('No pins to refresh.', 'idle');
      return;
    }

    updateStatus('Refreshing saved pins...', 'idle');

    var response = await sendMessage({
      type: 'REFRESH_ALL_PINS',
    });

    if (!response || !response.ok) {
      updateStatus((response && response.error) || 'Refresh all failed.', 'error');
      return;
    }

    var results = response.results || [];
    var resultById = {};
    for (var i = 0; i < results.length; i += 1) {
      resultById[results[i].id] = results[i];
    }

    state.pins = state.pins.map(function (item) {
      var r = resultById[item.id];
      if (!r) {
        return item;
      }
      if (r.ok && r.pin) {
        return r.pin;
      }
      return Object.assign({}, item, { syncError: r.error || 'Refresh failed' });
    });

    render();
    var hasFailures = state.pins.some(function (pin) {
      return Boolean(pin.syncError);
    });
    updateStatus(
      hasFailures
        ? 'Some pins could not be refreshed. Their saved snapshots are still preserved.'
        : 'All pins refreshed successfully.',
      hasFailures ? 'error' : 'success'
    );
  }

  async function openSource(pinId) {
    var pin = getPin(pinId);
    if (!pin) {
      return;
    }

    var response = await sendMessage({
      type: 'OPEN_PIN_SOURCE',
      url: pin.pageUrl,
    });

    if (!response || !response.ok) {
      throw new Error((response && response.error) || 'Could not open the source page');
    }

    updateStatus('Opened the saved source page.', 'success');
  }

  async function startCapture() {
    var titleHint = dom.captureTitle.value.trim();
    var repinPin = state.repinPinId ? getPin(state.repinPinId) : null;

    if (repinPin) {
      var activeTabMatches =
        state.activeTab &&
        AIUsageStorage.isHttpUrl((state.activeTab && state.activeTab.url) || '') &&
        isCompatibleTabUrl(repinPin.pageUrl, state.activeTab.url || '');
      var repinPayload = {
        type: 'PICKER_START',
        title: titleHint || repinPin.title,
        pinId: repinPin.id,
      };

      if (activeTabMatches) {
        repinPayload.tabId = state.activeTab.id;
      } else {
        repinPayload.url = repinPin.pageUrl;
      }

      var repinResponse = await sendMessage(repinPayload);
      if (!repinResponse || !repinResponse.ok) {
        throw new Error((repinResponse && repinResponse.error) || 'Could not start re-pin');
      }

      updateStatus(
        activeTabMatches
          ? 'Picker opened on this tab. Save the replacement snapshot there.'
          : 'Source page opened for re-pin. Save the replacement snapshot there.',
        'success'
      );
      window.setTimeout(function () {
        window.close();
      }, 140);
      return;
    }

    if (!state.activeTab || !AIUsageStorage.isHttpUrl(state.activeTab.url || '')) {
      throw new Error('Open an http or https page before creating a pin');
    }

    var response = await sendMessage({
      type: 'PICKER_START',
      tabId: state.activeTab.id,
      title: titleHint,
    });

    if (!response || !response.ok) {
      throw new Error((response && response.error) || 'Could not start the picker');
    }

    updateStatus('Picker opened on this tab. Save your pin from the page.', 'success');
    window.setTimeout(function () {
      window.close();
    }, 140);
  }

  async function handlePinListClick(event) {
    var actionButton = event.target.closest('[data-action]');
    if (!actionButton) {
      return;
    }

    var card = actionButton.closest('.pin-card');
    if (!card) {
      return;
    }

    var pinId = card.getAttribute('data-pin-id');
    var action = actionButton.getAttribute('data-action');

    if (action === 'drag') {
      return;
    }

    if (action === 'toggle-menu') {
      togglePinMenu(pinId);
      return;
    }

    closePinMenu();

    if (action === 'edit-title') {
      beginTitleEdit(pinId);
      return;
    }

    if (action === 'cancel-title') {
      cancelTitleEdit();
      return;
    }

    if (action === 'repin') {
      beginRepin(pinId);
      return;
    }

    setBusy(true);

    try {
      if (action === 'save-title') {
        await saveTitle(pinId);
        return;
      }

      if (action === 'refresh') {
        await refreshPin(pinId);
        updateStatus('Pin refreshed.', 'success');
        return;
      }

      if (action === 'open') {
        await openSource(pinId);
        return;
      }

      if (action === 'remove') {
        await removePin(pinId);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handlePinListKeydown(event) {
    if (event.key === 'Escape' && state.openMenuPinId) {
      event.preventDefault();
      closePinMenu();
      return;
    }

    if (!event.target.classList.contains('pin-card__title-input')) {
      return;
    }

    var card = event.target.closest('.pin-card');
    if (!card) {
      return;
    }

    var pinId = card.getAttribute('data-pin-id');

    if (event.key === 'Enter') {
      event.preventDefault();
      setBusy(true);
      try {
        await saveTitle(pinId);
      } finally {
        setBusy(false);
      }
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      cancelTitleEdit();
    }
  }

  function cacheDom() {
    dom.captureHeading = document.getElementById('capture-heading');
    dom.captureModeBadge = document.getElementById('capture-mode-badge');
    dom.captureHelp = document.getElementById('capture-help');
    dom.captureTitle = document.getElementById('capture-title');
    dom.captureButton = document.getElementById('capture-button');
    dom.captureCancel = document.getElementById('capture-cancel');
    dom.statusBanner = document.getElementById('status-banner');
    dom.pinCount = document.getElementById('pin-count');
    dom.currentTabHost = document.getElementById('current-tab-host');
    dom.boardSummary = document.getElementById('board-summary');
    dom.pinViewLayout = document.getElementById('pin-view-layout');
    dom.refreshAll = document.getElementById('refresh-all');
    dom.pinList = document.getElementById('pin-list');
  }

  function bindEvents() {
    dom.captureButton.addEventListener('click', function () {
      setBusy(true);
      startCapture()
        .catch(function (error) {
          updateStatus(error.message, 'error');
        })
        .finally(function () {
          setBusy(false);
        });
    });

    dom.captureCancel.addEventListener('click', function () {
      cancelRepin();
    });

    dom.refreshAll.addEventListener('click', function () {
      setBusy(true);
      refreshAllPins()
        .catch(function (error) {
          updateStatus(error.message, 'error');
        })
        .finally(function () {
          setBusy(false);
        });
    });

    if (dom.pinViewLayout) {
      dom.pinViewLayout.addEventListener('change', function () {
        var next = normalizeViewLayout(dom.pinViewLayout.value);
        state.viewLayout = next;
        callbackToPromise(function (resolve) {
          var payload = {};
          payload[VIEW_LAYOUT_STORAGE_KEY] = next;
          chrome.storage.local.set(payload, resolve);
        })
          .then(function () {
            render();
          })
          .catch(function (error) {
            updateStatus(error.message, 'error');
          });
      });
    }

    dom.pinList.addEventListener('click', function (event) {
      handlePinListClick(event).catch(function (error) {
        updateStatus(error.message, 'error');
        setBusy(false);
      });
    });

    dom.pinList.addEventListener('keydown', function (event) {
      handlePinListKeydown(event).catch(function (error) {
        updateStatus(error.message, 'error');
        setBusy(false);
      });
    });

    document.addEventListener('click', function (event) {
      if (!state.openMenuPinId) {
        return;
      }

      if (event.target.closest('.pin-card__menu')) {
        return;
      }

      closePinMenu();
    });
  }

  async function init() {
    cacheDom();
    bindEvents();
    await loadState();
    render();

    if (state.activeTab && AIUsageStorage.isHttpUrl((state.activeTab && state.activeTab.url) || '')) {
      updateStatus('Ready to capture from ' + getHostname(state.activeTab.url) + '.', 'idle');
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    init().catch(function (error) {
      updateStatus(error.message, 'error');
    });
  });
})();
