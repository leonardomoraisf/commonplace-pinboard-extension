(function () {
  'use strict';

  if (!window.AIUsageStorage) {
    return;
  }

  var state = {
    entries: [],
    editingTitleId: null,
    editingField: null,
    reconfigureEntryId: null,
    cardMenuEntryId: null,
    sortable: null,
    busy: false,
    composerVisible: false,
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

  function tabsReload(tabId) {
    return callbackToPromise(function (resolve) {
      chrome.tabs.reload(tabId, {}, resolve);
    });
  }

  function formatRelativeTime(value) {
    if (!value) {
      return 'Never updated';
    }

    var timestamp = new Date(value);
    if (Number.isNaN(timestamp.getTime())) {
      return 'Never updated';
    }

    var seconds = Math.round((Date.now() - timestamp.getTime()) / 1000);
    if (seconds < 30) {
      return 'Updated just now';
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
        return 'Updated ' + amount + ' ' + unit[0] + (amount === 1 ? '' : 's') + ' ago';
      }
    }

    return 'Updated moments ago';
  }

  function formatShortDate(value) {
    if (!value) {
      return '';
    }

    var date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return date.toLocaleString([], {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  }

  function firstHostname(value) {
    try {
      return new URL(value).hostname.replace(/^www\./, '');
    } catch (_error) {
      return value;
    }
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

  function isNumericish(value) {
    var text = String(value || '').trim();
    return /^[\d.,%+-]+$/.test(text) || /^\d+(\.\d+)?\s*%$/.test(text);
  }

  function updateSyncStatus(text, kind) {
    dom.syncStatus.textContent = text;
    dom.statusBanner.textContent = text;
    dom.statusBanner.dataset.kind = kind || 'idle';
  }

  function setBusy(isBusy) {
    state.busy = isBusy;
    dom.entrySubmit.disabled = isBusy;
    dom.entryUrl.disabled = isBusy;
    dom.entryTitle.disabled = isBusy;
    if (dom.refreshAll) {
      dom.refreshAll.disabled = isBusy || !state.entries.length;
    }
    if (dom.reloadPages) {
      dom.reloadPages.disabled = isBusy || !state.entries.length;
    }
  }

  function setComposerVisible(visible) {
    state.composerVisible = visible;
    dom.composerPanel.classList.toggle('composer--collapsed', !visible);
    dom.toggleComposer.textContent = visible ? 'Hide add form' : 'Add link';
    dom.toggleComposer.setAttribute('aria-pressed', String(visible));
  }

  function setComposerMode(entry) {
    if (entry) {
      state.reconfigureEntryId = entry.id;
      setComposerVisible(true);
      dom.composerMode.textContent = 'Reconfigure: ' + entry.title;
      dom.composerCancel.hidden = false;
      dom.entrySubmit.querySelector('.primary-button__label').textContent = 'Update fields';
      dom.entryUrl.value = entry.pageUrl;
      dom.entryTitle.value = entry.title;
      dom.entryUrl.focus();
      dom.entryUrl.select();
      return;
    }

    state.reconfigureEntryId = null;
    dom.composerMode.textContent = 'New site';
    dom.composerCancel.hidden = true;
    dom.entrySubmit.querySelector('.primary-button__label').textContent = 'Start picking';
  }

  function clearComposerInputs() {
    dom.entryUrl.value = '';
    dom.entryTitle.value = '';
  }

  function getStoredEntry(entryId) {
    return state.entries.find(function (entry) {
      return entry.id === entryId;
    });
  }

  function syncEntryCount() {
    dom.entryCount.textContent = String(state.entries.length);
    dom.listSummary.textContent = state.entries.length > 0 ? 'Sorted by your manual order' : 'No entries yet';
    if (dom.refreshAll) {
      dom.refreshAll.disabled = state.busy || !state.entries.length;
    }
    if (dom.reloadPages) {
      dom.reloadPages.disabled = state.busy || !state.entries.length;
    }
  }

  function getFieldEditingInput() {
    if (!state.editingField) {
      return null;
    }

    var entrySelector = '[data-entry-id="' + CSS.escape(state.editingField.entryId) + '"]';
    var fieldSelector = '[data-action="field-label-input"][data-field-id="' + CSS.escape(state.editingField.fieldId) + '"]';
    return dom.cardList.querySelector(entrySelector + ' ' + fieldSelector);
  }

  function clearFieldLabelEdit() {
    state.editingField = null;
  }

  function setFieldLabelEdit(entryId, fieldId) {
    if (!entryId || !fieldId) {
      return;
    }

    state.editingTitleId = null;
    state.cardMenuEntryId = null;
    state.editingField = {
      entryId: entryId,
      fieldId: fieldId,
    };
    render();
  }

  function closeCardMenu() {
    if (state.cardMenuEntryId === null) {
      return;
    }

    state.cardMenuEntryId = null;
    if (dom.cardMenuLayer) {
      dom.cardMenuLayer.innerHTML = '';
      dom.cardMenuLayer.setAttribute('aria-hidden', 'true');
    }
  }

  function renderCardMenuLayer() {
    if (!dom.cardMenuLayer) {
      return;
    }

    if (state.cardMenuEntryId === null) {
      dom.cardMenuLayer.innerHTML = '';
      dom.cardMenuLayer.setAttribute('aria-hidden', 'true');
      return;
    }

    var entry = getStoredEntry(state.cardMenuEntryId);
    if (!entry) {
      closeCardMenu();
      return;
    }

    var card = dom.cardList.querySelector('[data-entry-id="' + CSS.escape(entry.id) + '"]');
    var toggleButton = card && card.querySelector('[data-action="toggle-menu"]');
    if (!card || !toggleButton) {
      closeCardMenu();
      return;
    }

    dom.cardMenuLayer.setAttribute('aria-hidden', 'false');
    dom.cardMenuLayer.innerHTML =
      '<div class="card__menu card__menu--open" data-entry-id="' +
      escapeHtml(entry.id) +
      '">' +
      '<button class="card__menu-item" type="button" data-action="edit-title">' +
      (state.editingTitleId === entry.id ? 'Done' : 'Edit title') +
      '</button>' +
      '<button class="card__menu-item card__menu-item--accent" type="button" data-action="reconfigure">Re-pin</button>' +
      '<button class="card__menu-item" type="button" data-action="open">Open</button>' +
      '<button class="card__menu-item card__menu-item--danger" type="button" data-action="remove">Remove</button>' +
      '</div>';

    var menu = dom.cardMenuLayer.querySelector('.card__menu');
    if (!menu) {
      return;
    }

    var buttonRect = toggleButton.getBoundingClientRect();
    var menuRect = menu.getBoundingClientRect();
    var left = Math.min(window.innerWidth - menuRect.width - 12, Math.max(12, buttonRect.right - menuRect.width));
    var top = buttonRect.top - menuRect.height - 10;

    if (top < 12) {
      top = buttonRect.bottom + 10;
    }

    menu.style.left = Math.max(12, left) + 'px';
    menu.style.top = Math.max(12, top) + 'px';
  }

  function renderField(field) {
    var value = field.valueText || 'No value';
    var numeric = isNumericish(value);
    var isEditingField =
      state.editingField &&
      state.editingField.entryId === field.entryId &&
      state.editingField.fieldId === field.id;

    return (
      '<div class="field-stat' +
      (numeric ? ' field-stat--numeric' : '') +
      (isEditingField ? ' field-stat--editing' : '') +
      '">' +
      (isEditingField
        ? '<input class="input field-stat__label-input" type="text" maxlength="' +
          String(AIUsageStorage.MAX_FIELD_LABEL_LENGTH) +
          '" value="' +
          escapeHtml(field.label) +
          '" data-action="field-label-input" data-entry-id="' +
          escapeHtml(field.entryId) +
          '" data-field-id="' +
          escapeHtml(field.id) +
          '" />'
        : '<button class="field-stat__label-button" type="button" data-action="edit-field-label" data-entry-id="' +
          escapeHtml(field.entryId) +
          '" data-field-id="' +
          escapeHtml(field.id) +
          '">' +
          escapeHtml(field.label) +
          '</button>') +
      '<div class="field-stat__value">' + escapeHtml(value) + '</div>' +
      '</div>'
    );
  }

  function render() {
    var scrollTop = dom.appShell.scrollTop;
    syncEntryCount();

    if (!state.entries.length) {
      dom.cardList.innerHTML =
        '<div class="empty-state" role="note">' +
        '<h3 class="empty-state__title">Nothing pinned yet</h3>' +
        '<p class="empty-state__text">Start with Cursor spending, ChatGPT / Codex, or any other http/https page. Pick multiple values from the screen and give each one a name.</p>' +
        '<div class="seed-rail">' +
        '<button class="seed-chip" type="button" data-seed-url="https://cursor.com/dashboard/spending">Cursor spending</button>' +
        '<button class="seed-chip" type="button" data-seed-url="https://chatgpt.com/">ChatGPT / Codex</button>' +
        '</div>' +
        '</div>';
      dom.appShell.scrollTop = scrollTop;
      updateListInteractions();
      return;
    }

    dom.cardList.innerHTML = state.entries
      .map(function (entry, index) {
        var faviconMarkup = entry.faviconUrl
          ? '<img src="' + escapeHtml(entry.faviconUrl) + '" alt="" referrerpolicy="no-referrer" loading="lazy" />'
          : '<span>' + escapeHtml((entry.title || '?').trim().charAt(0).toUpperCase() || '?') + '</span>';
        var editMode = state.editingTitleId === entry.id;
        var fieldCount = entry.fields.length;
        var errorText = entry.syncError ? '<span class="card__error">Sync: ' + escapeHtml(entry.syncError) + '</span>' : '';

        return (
          '<article class="card' +
          (editMode ? ' is-editing' : '') +
          '" role="listitem" data-entry-id="' +
          escapeHtml(entry.id) +
          '" style="--card-order:' +
          index +
          ';">' +
          '<div class="card__top">' +
          '<div class="card__identity">' +
          '<div class="favicon">' + faviconMarkup + '</div>' +
          '<div class="card__body">' +
          '<div class="card__title-row">' +
          '<input class="input card__title-input" type="text" maxlength="200" value="' +
          escapeHtml(entry.title) +
          '" data-action="title-input" />' +
          '<span class="card__title-view">' + escapeHtml(entry.title) + '</span>' +
          '</div>' +
          '<div class="card__meta">' +
          '<span><strong>' + escapeHtml(firstHostname(entry.pageUrl)) + '</strong></span>' +
          '<span>' + fieldCount + ' fields</span>' +
          '<span title="' + escapeHtml(formatShortDate(entry.updatedAt)) + '">' +
          escapeHtml(formatRelativeTime(entry.updatedAt)) +
          '</span>' +
          errorText +
          '</div>' +
          '</div>' +
          '</div>' +
          '<div class="card__actions">' +
          '<button class="action-button action-button--grab" type="button" data-action="drag" title="Drag to reorder" aria-label="Drag to reorder">⋮⋮</button>' +
          '<button class="action-button action-button--menu" type="button" data-action="toggle-menu" aria-expanded="' +
          String(state.cardMenuEntryId === entry.id) +
          '" aria-label="More actions">' +
          '⋯' +
          '</button>' +
          '</div>' +
          '</div>' +
          '<div class="field-grid">' +
          entry.fields
            .map(function (field) {
              return renderField(Object.assign({ entryId: entry.id }, field));
            })
            .join('') +
          '</div>' +
          '</article>'
        );
      })
      .join('');

    dom.appShell.scrollTop = scrollTop;
    updateListInteractions();
    renderCardMenuLayer();
    focusFieldEditor();
  }

  function focusFieldEditor() {
    var input = getFieldEditingInput();
    if (!input) {
      return;
    }

    window.setTimeout(function () {
      input.focus();
      input.select();
    }, 0);
  }

  function updateListInteractions() {
    if (state.sortable) {
      state.sortable.destroy();
      state.sortable = null;
    }

    if (!state.entries.length) {
      return;
    }

    state.sortable = Sortable.create(dom.cardList, {
      animation: 170,
      draggable: '.card',
      handle: '.action-button--grab',
      ghostClass: 'is-ghost',
      chosenClass: 'is-chosen',
      dragClass: 'is-dragging',
      onEnd: handleReorder,
    });
  }

  async function handleReorder() {
    var cardIds = Array.prototype.slice.call(dom.cardList.querySelectorAll('.card')).map(function (card) {
      return card.dataset.entryId;
    });

    state.entries = cardIds
      .map(function (id, index) {
        var entry = getStoredEntry(id);
        if (!entry) {
          return null;
        }

        return Object.assign({}, entry, { order: index });
      })
      .filter(Boolean);

    state.entries = AIUsageStorage.reindexEntries(state.entries);
    await AIUsageStorage.saveEntries(state.entries);
    render();
    updateSyncStatus('Order saved', 'success');
  }

  async function refreshEntry(entryId, options) {
    var shouldRender = !options || options.render !== false;
    var response = await sendMessage({
      type: 'REFRESH_ENTRY',
      id: entryId,
    });

    if (!response || !response.ok) {
      throw new Error((response && response.error) || 'Refresh failed');
    }

    state.entries = state.entries.map(function (entry) {
      if (entry.id !== entryId) {
        return entry;
      }

      return Object.assign({}, entry, {
        fields: response.fields || entry.fields,
        updatedAt: response.updatedAt,
        syncError: '',
      });
    });

    if (shouldRender) {
      render();
    }

    return response;
  }

  async function refreshAllEntries() {
    if (!state.entries.length) {
      updateSyncStatus('Ready', 'idle');
      return;
    }

    updateSyncStatus('Refreshing live fields…', 'idle');
    var hadError = false;

    for (var index = 0; index < state.entries.length; index += 1) {
      var entry = state.entries[index];
      try {
        await refreshEntry(entry.id, { render: false });
        updateSyncStatus('Refreshed ' + (index + 1) + '/' + state.entries.length, 'success');
      } catch (error) {
        hadError = true;
        state.entries = state.entries.map(function (item) {
          if (item.id !== entry.id) {
            return item;
          }

          return Object.assign({}, item, { syncError: error.message });
        });
        updateSyncStatus(error.message, 'error');
      }
    }

    render();
    updateSyncStatus(hadError ? 'Some fields could not refresh' : 'Fields synchronized', hadError ? 'error' : 'success');
  }

  async function reloadOpenPages() {
    if (!state.entries.length) {
      updateSyncStatus('Ready', 'idle');
      return;
    }

    updateSyncStatus('Reloading open pages…', 'idle');

    var tabs = await tabsQuery({});
    var matchingTabs = tabs
      .filter(function (tab) {
        return tab && tab.id !== undefined && typeof tab.url === 'string';
      })
      .filter(function (tab) {
        return state.entries.some(function (entry) {
          return isCompatibleTabUrl(entry.pageUrl, tab.url);
        });
      });

    for (var index = 0; index < matchingTabs.length; index += 1) {
      var tab = matchingTabs[index];
      await tabsReload(tab.id);
      await new Promise(function (resolve) {
        window.setTimeout(resolve, 900);
      });
    }

    await new Promise(function (resolve) {
      window.setTimeout(resolve, 1400);
    });
    await refreshAllEntries();
  }

  async function submitComposer(event) {
    event.preventDefault();

    var normalizedUrl = AIUsageStorage.normalizeHttpUrl(dom.entryUrl.value);
    if (!normalizedUrl) {
      updateSyncStatus('Enter a valid http/https URL', 'error');
      dom.entryUrl.focus();
      return;
    }

    setBusy(true);
    updateSyncStatus('Opening field picker…', 'idle');

    try {
      var response = await sendMessage({
        type: 'PICKER_START',
        url: normalizedUrl,
        title: dom.entryTitle.value.trim(),
        entryId: state.reconfigureEntryId || undefined,
      });

      if (!response || !response.ok) {
        throw new Error((response && response.error) || 'Picker failed');
      }

      state.entries = await AIUsageStorage.loadEntries();
      state.editingTitleId = null;
      setComposerMode(null);
      setComposerVisible(false);
      clearComposerInputs();
      render();
      updateSyncStatus('Fields saved', 'success');
    } catch (error) {
      updateSyncStatus(error.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function toggleTitleEdit(entryId) {
    if (state.editingTitleId === entryId) {
      var currentCard = dom.cardList.querySelector('[data-entry-id="' + CSS.escape(entryId) + '"]');
      var currentInput = currentCard && currentCard.querySelector('[data-action="title-input"]');
      if (currentInput) {
        await commitTitleInput(entryId, currentInput);
      } else {
        state.editingTitleId = null;
        render();
      }
      return;
    }

    clearFieldLabelEdit();
    state.editingTitleId = entryId;
    render();

    var card = dom.cardList.querySelector('[data-entry-id="' + CSS.escape(entryId) + '"]');
    if (!card) {
      return;
    }

    var input = card.querySelector('[data-action="title-input"]');
    if (input) {
      input.focus();
      input.select();
    }
  }

  async function commitTitleInput(entryId, input) {
    var nextTitle = input.value.trim();
    if (!nextTitle) {
      updateSyncStatus('Title cannot be empty', 'error');
      input.focus();
      return;
    }

    state.entries = state.entries.map(function (entry) {
      if (entry.id !== entryId) {
        return entry;
      }

      return Object.assign({}, entry, {
        title: nextTitle,
      });
    });

    state.entries = await AIUsageStorage.saveEntries(state.entries);
    state.editingTitleId = null;
    clearFieldLabelEdit();
    render();
    updateSyncStatus('Title saved', 'success');
  }

  async function handleCardClick(event) {
    var actionButton = event.target.closest('[data-action]');
    if (!actionButton) {
      return;
    }

    var card = actionButton.closest('.card');
    if (!card) {
      return;
    }

    var entryId = card.dataset.entryId;
    var entry = getStoredEntry(entryId);
    var action = actionButton.dataset.action;

    if (action === 'drag') {
      return;
    }

    if (action === 'toggle-menu') {
      clearFieldLabelEdit();
      state.cardMenuEntryId = state.cardMenuEntryId === entryId ? null : entryId;
      render();
      return;
    }

    if (action === 'open') {
      clearFieldLabelEdit();
      closeCardMenu();
      render();
      chrome.tabs.create({ url: entry.pageUrl });
      updateSyncStatus('Opened full page', 'success');
      return;
    }

    if (action === 'reconfigure') {
      clearFieldLabelEdit();
      closeCardMenu();
      render();
      setComposerMode(entry);
      updateSyncStatus('Composer loaded for re-pin', 'idle');
      return;
    }

    if (action === 'remove') {
      clearFieldLabelEdit();
      closeCardMenu();
      render();
      var confirmed = window.confirm('Remove "' + entry.title + '"?');
      if (!confirmed) {
        return;
      }

      state.entries = AIUsageStorage.removeEntry(state.entries, entryId);
      state.entries = await AIUsageStorage.saveEntries(state.entries);
      if (state.editingTitleId === entryId) {
        state.editingTitleId = null;
      }
      if (state.reconfigureEntryId === entryId) {
        setComposerMode(null);
      }
      render();
      updateSyncStatus('Entry removed', 'success');
      return;
    }

    if (action === 'edit-title') {
      clearFieldLabelEdit();
      closeCardMenu();
      render();
      await toggleTitleEdit(entryId);
    }
  }

  async function handleMenuClick(event) {
    var actionButton = event.target.closest('[data-action]');
    if (!actionButton) {
      return;
    }

    var entryId = state.cardMenuEntryId;
    if (!entryId) {
      return;
    }

    var entry = getStoredEntry(entryId);
    if (!entry) {
      closeCardMenu();
      return;
    }

    var action = actionButton.dataset.action;

    if (action === 'edit-title') {
      clearFieldLabelEdit();
      closeCardMenu();
      render();
      await toggleTitleEdit(entryId);
      return;
    }

    if (action === 'reconfigure') {
      clearFieldLabelEdit();
      closeCardMenu();
      render();
      setComposerMode(entry);
      updateSyncStatus('Composer loaded for re-pin', 'idle');
      return;
    }

    if (action === 'open') {
      clearFieldLabelEdit();
      closeCardMenu();
      render();
      chrome.tabs.create({ url: entry.pageUrl });
      updateSyncStatus('Opened full page', 'success');
      return;
    }

    if (action === 'remove') {
      clearFieldLabelEdit();
      closeCardMenu();
      render();
      var confirmed = window.confirm('Remove "' + entry.title + '"?');
      if (!confirmed) {
        return;
      }

      state.entries = AIUsageStorage.removeEntry(state.entries, entryId);
      state.entries = await AIUsageStorage.saveEntries(state.entries);
      if (state.editingTitleId === entryId) {
        state.editingTitleId = null;
      }
      if (state.reconfigureEntryId === entryId) {
        setComposerMode(null);
      }
      render();
      updateSyncStatus('Entry removed', 'success');
    }
  }

  async function commitFieldLabelInput(entryId, fieldId, input) {
    var nextLabel = AIUsageStorage.clampText(input.value, AIUsageStorage.MAX_FIELD_LABEL_LENGTH);
    if (!nextLabel) {
      updateSyncStatus('Field name cannot be empty', 'error');
      input.focus();
      return;
    }

    state.entries = state.entries.map(function (entry) {
      if (entry.id !== entryId) {
        return entry;
      }

      return Object.assign({}, entry, {
        fields: entry.fields.map(function (field) {
          if (field.id !== fieldId) {
            return field;
          }

          return Object.assign({}, field, {
            label: nextLabel,
          });
        }),
      });
    });

    state.entries = await AIUsageStorage.saveEntries(state.entries);
    clearFieldLabelEdit();
    render();
    updateSyncStatus('Field name saved', 'success');
  }

  async function handleCardInput(event) {
    var target = event.target;
    if (target.matches('[data-action="title-input"]')) {
      if (event.key === 'Enter') {
        event.preventDefault();
        await commitTitleInput(target.closest('.card').dataset.entryId, target);
        return;
      }

      if (event.key === 'Escape') {
        state.editingTitleId = null;
        render();
      }
      return;
    }

    if (target.matches('[data-action="field-label-input"]')) {
      if (event.key === 'Enter') {
        event.preventDefault();
        await commitFieldLabelInput(
          target.getAttribute('data-entry-id'),
          target.getAttribute('data-field-id'),
          target
        );
        return;
      }

      if (event.key === 'Escape') {
        clearFieldLabelEdit();
        render();
      }
    }
  }

  async function handleCardBlur(event) {
    var target = event.target;
    if (target.matches('[data-action="title-input"]')) {
      var entryId = target.closest('.card').dataset.entryId;
      if (state.editingTitleId !== entryId) {
        return;
      }

      window.setTimeout(function () {
        var activeElement = document.activeElement;
        if (activeElement && target.closest('.card').contains(activeElement)) {
          return;
        }

        commitTitleInput(entryId, target).catch(function (error) {
          updateSyncStatus(error.message, 'error');
        });
      }, 0);
      return;
    }

    if (target.matches('[data-action="field-label-input"]')) {
      var fieldEntryId = target.getAttribute('data-entry-id');
      var fieldId = target.getAttribute('data-field-id');
      if (
        !state.editingField ||
        state.editingField.entryId !== fieldEntryId ||
        state.editingField.fieldId !== fieldId
      ) {
        return;
      }

      window.setTimeout(function () {
        var activeElement = document.activeElement;
        if (activeElement && target.closest('.card').contains(activeElement)) {
          return;
        }

        commitFieldLabelInput(fieldEntryId, fieldId, target).catch(function (error) {
          updateSyncStatus(error.message, 'error');
        });
      }, 0);
    }
  }

  function handleSeedClick(event) {
    var chip = event.target.closest('[data-seed-url]');
    if (!chip) {
      return;
    }

    dom.entryUrl.value = chip.dataset.seedUrl;
    dom.entryUrl.focus();
    dom.entryUrl.select();
    updateSyncStatus('Seed URL inserted', 'idle');
  }

  function bindEvents() {
    dom.entryForm.addEventListener('submit', submitComposer);
    dom.toggleComposer.addEventListener('click', function () {
      clearFieldLabelEdit();
      var nextVisible = !state.composerVisible;
      setComposerVisible(nextVisible);
      if (!nextVisible && state.reconfigureEntryId) {
        setComposerMode(null);
      }
    });
    dom.cardList.addEventListener('click', function (event) {
      handleCardClick(event).catch(function (error) {
        updateSyncStatus(error.message, 'error');
      });
    });
    dom.cardList.addEventListener('keydown', function (event) {
      handleCardInput(event).catch(function (error) {
        updateSyncStatus(error.message, 'error');
      });
    });
    dom.cardList.addEventListener('blur', function (event) {
      handleCardBlur(event).catch(function (error) {
        updateSyncStatus(error.message, 'error');
      });
    }, true);
    dom.cardList.addEventListener('click', handleSeedClick);
    dom.cardList.addEventListener('dblclick', function (event) {
      var labelButton = event.target.closest('[data-action="edit-field-label"]');
      if (!labelButton) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setFieldLabelEdit(
        labelButton.getAttribute('data-entry-id'),
        labelButton.getAttribute('data-field-id')
      );
    });
    dom.cardMenuLayer.addEventListener('click', function (event) {
      handleMenuClick(event).catch(function (error) {
        updateSyncStatus(error.message, 'error');
      });
    });
    dom.reloadPages.addEventListener('click', function () {
      if (dom.reloadPages.disabled) {
        return;
      }

      setBusy(true);
      reloadOpenPages()
        .catch(function (error) {
          updateSyncStatus(error.message, 'error');
        })
        .finally(function () {
          setBusy(false);
        });
    });
    dom.cardList.addEventListener('scroll', function () {
      if (state.cardMenuEntryId !== null) {
        closeCardMenu();
      }
    }, { passive: true });
    dom.refreshAll.addEventListener('click', function () {
      if (dom.refreshAll.disabled) {
        return;
      }

      setBusy(true);
      refreshAllEntries()
        .catch(function (error) {
          updateSyncStatus(error.message, 'error');
        })
        .finally(function () {
          setBusy(false);
        });
    });
    dom.composerCancel.addEventListener('click', function () {
      setComposerMode(null);
      updateSyncStatus('Reconfigure cancelled', 'idle');
    });
    document.addEventListener('click', function (event) {
      if (event.target.closest('.card-menu-layer')) {
        return;
      }

      if (!event.target.closest('.card') && state.cardMenuEntryId !== null) {
        closeCardMenu();
        render();
      }
    });
    window.addEventListener('resize', function () {
      if (state.cardMenuEntryId !== null) {
        render();
      }
    });
  }

  function cacheDom() {
    dom.entryForm = document.getElementById('entry-form');
    dom.entryUrl = document.getElementById('entry-url');
    dom.entryTitle = document.getElementById('entry-title');
    dom.entrySubmit = document.getElementById('entry-submit');
    dom.composerMode = document.getElementById('composer-mode');
    dom.composerCancel = document.getElementById('composer-cancel');
    dom.composerPanel = document.getElementById('composer-panel');
    dom.toggleComposer = document.getElementById('toggle-composer');
    dom.entryCount = document.getElementById('entry-count');
    dom.syncStatus = document.getElementById('sync-status');
    dom.statusBanner = document.getElementById('status-banner');
    dom.appShell = document.querySelector('.app-shell');
    dom.cardList = document.getElementById('card-list');
    dom.listSummary = document.getElementById('list-summary');
    dom.reloadPages = document.getElementById('reload-pages');
    dom.refreshAll = document.getElementById('refresh-all');
    dom.cardMenuLayer = document.getElementById('card-menu-layer');
  }

  async function init() {
    cacheDom();
    bindEvents();
    setComposerVisible(false);

    try {
      state.entries = await AIUsageStorage.loadEntries();
      render();
      if (dom.refreshAll) {
        dom.refreshAll.disabled = !state.entries.length;
      }
      if (state.entries.length) {
        await refreshAllEntries();
      } else {
        updateSyncStatus('Add a URL to begin', 'idle');
      }
    } catch (error) {
      updateSyncStatus(error.message, 'error');
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    init().catch(function (error) {
      updateSyncStatus(error.message, 'error');
    });
  });
})();
