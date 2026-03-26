(function () {
  'use strict';

  if (window.__PINBOARD_PICKER_ACTIVE__) {
    return;
  }

  window.__PINBOARD_PICKER_ACTIVE__ = true;

  var overlayRoot = null;
  var highlightBox = null;
  var instructionDock = null;
  var labelEditor = null;
  var labelInput = null;
  var labelValue = null;
  var savedPinsList = null;
  var statusLine = null;
  var activeCandidate = null;
  var savedPins = [];
  var active = true;
  var pickerEnabled = true;

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

  function escapeCssIdentifier(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') {
      return window.CSS.escape(value);
    }

    return String(value).replace(/[^a-zA-Z0-9_-]/g, function (character) {
      return '\\' + character.charCodeAt(0).toString(16) + ' ';
    });
  }

  function makeAbsoluteSelector(element) {
    if (!element || element.nodeType !== 1) {
      return '';
    }

    if (element.id) {
      var idSelector = '#' + escapeCssIdentifier(element.id);
      if (document.querySelectorAll(idSelector).length === 1) {
        return idSelector;
      }
    }

    var parts = [];
    var current = element;

    while (current && current.nodeType === 1 && current !== document.documentElement) {
      var selector = current.nodeName.toLowerCase();
      if (current.id) {
        var currentIdSelector = '#' + escapeCssIdentifier(current.id);
        if (document.querySelectorAll(currentIdSelector).length === 1) {
          parts.unshift(currentIdSelector);
          break;
        }
      }

      var parent = current.parentElement;
      if (parent) {
        var sameTagSiblings = Array.prototype.filter.call(parent.children, function (child) {
          return child.nodeName === current.nodeName;
        });

        if (sameTagSiblings.length > 1) {
          selector += ':nth-of-type(' + (sameTagSiblings.indexOf(current) + 1) + ')';
        }
      }

      parts.unshift(selector);
      current = parent;
    }

    return parts.join(' > ');
  }

  function normalizeWhitespace(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isMeaningfulText(value) {
    var normalized = normalizeWhitespace(value);
    return Boolean(normalized) && /[A-Za-z0-9]/.test(normalized);
  }

  function readPageMetadata() {
    var iconLink = document.querySelector(
      'link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]'
    );

    return {
      pageTitle: document.title ? document.title.trim() : '',
      faviconUrl: iconLink && iconLink.href ? iconLink.href : '',
      pageUrl: location.href,
    };
  }

  function readFieldValue(node) {
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

  function suggestPinLabel(node, valueText) {
    var candidates = [];

    if (node && node.getAttribute) {
      candidates.push(node.getAttribute('aria-label'));
      candidates.push(node.getAttribute('data-label'));
      candidates.push(node.getAttribute('title'));
      candidates.push(node.getAttribute('placeholder'));
      candidates.push(node.getAttribute('data-testid'));
      candidates.push(node.getAttribute('name'));
    }

    candidates.push(valueText);

    for (var index = 0; index < candidates.length; index += 1) {
      var candidate = normalizeWhitespace(candidates[index]);
      if (candidate && candidate.length <= 80) {
        return candidate;
      }
    }

    return 'Saved pin';
  }

  function serializeCandidate(element) {
    var valueText = readFieldValue(element);

    return {
      label: suggestPinLabel(element, valueText),
      selector: makeAbsoluteSelector(element),
      valueText: valueText,
    };
  }

  function setStatus(text, kind) {
    if (!statusLine) {
      return;
    }

    statusLine.textContent = text;
    statusLine.setAttribute('data-kind', kind || 'idle');
  }

  function ensureOverlay() {
    if (overlayRoot) {
      return;
    }

    overlayRoot = document.createElement('div');
    overlayRoot.id = '__pinboard_picker_overlay__';
    overlayRoot.style.cssText =
      'position:fixed;inset:0;z-index:2147483647;pointer-events:none;font-family:"Trebuchet MS","Gill Sans",sans-serif;';

    highlightBox = document.createElement('div');
    highlightBox.style.cssText =
      'position:fixed;left:0;top:0;width:0;height:0;pointer-events:none;border:2px solid #e39d39;background:rgba(227,157,57,.14);box-shadow:0 0 0 1px rgba(19,24,18,.45),0 16px 42px rgba(8,10,8,.35);border-radius:14px;transition:transform 120ms ease,opacity 120ms ease;opacity:0;';

    instructionDock = document.createElement('div');
    instructionDock.style.cssText =
      'position:fixed;right:16px;bottom:16px;max-width:min(420px,calc(100vw - 32px));padding:16px 18px;border-radius:22px;border:1px solid rgba(255,245,222,.18);background:linear-gradient(180deg,rgba(22,26,22,.96),rgba(15,19,17,.94));box-shadow:0 28px 60px rgba(0,0,0,.45);backdrop-filter:blur(16px);color:#f7eedc;pointer-events:auto;';
    instructionDock.innerHTML =
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:10px;">' +
      '<div>' +
      '<div style="font-size:10px;letter-spacing:.24em;text-transform:uppercase;color:#d7a24f;margin-bottom:6px;">Capture mode</div>' +
      '<strong style="font-family:Baskerville,Georgia,serif;font-size:24px;line-height:1.05;font-weight:600;">Save a pin from this page</strong>' +
      '</div>' +
      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end;">' +
      '<button type="button" data-picker-toggle style="border:1px solid rgba(255,245,222,.18);border-radius:999px;background:rgba(255,255,255,.04);color:#f7eedc;padding:7px 12px;font-weight:700;cursor:pointer;">Pause</button>' +
      '<button type="button" data-picker-done style="border:0;border-radius:999px;background:#d7a24f;color:#201a11;padding:7px 14px;font-weight:800;cursor:pointer;">Done</button>' +
      '</div>' +
      '</div>' +
      '<p style="margin:0 0 10px;font-size:13px;line-height:1.55;color:rgba(247,238,220,.78);">Click a visible value, heading, or text block. Each save stores one snapshot immediately so you can keep collecting while you stay on the page.</p>' +
      '<div data-picker-status style="margin-bottom:10px;font-size:12px;line-height:1.5;color:#f0d5a6;">Ready to capture</div>' +
      '<div style="font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:rgba(247,238,220,.56);margin-bottom:8px;">Session saves</div>' +
      '<div data-picker-saved-list style="display:grid;gap:8px;max-height:168px;overflow:auto;padding-right:2px;"></div>' +
      '<div style="display:flex;justify-content:flex-end;margin-top:12px;">' +
      '<button type="button" data-picker-cancel style="border:1px solid rgba(255,245,222,.18);border-radius:999px;background:transparent;color:#f7eedc;padding:7px 12px;cursor:pointer;">Cancel</button>' +
      '</div>';

    labelEditor = document.createElement('div');
    labelEditor.style.cssText =
      'position:fixed;inset:0;display:none;align-items:center;justify-content:center;pointer-events:auto;background:rgba(7,10,8,.55);backdrop-filter:blur(8px);';
    labelEditor.innerHTML =
      '<div style="width:min(440px,calc(100vw - 32px));border-radius:22px;border:1px solid rgba(255,245,222,.16);background:linear-gradient(180deg,rgba(242,232,214,.98),rgba(230,217,198,.98));box-shadow:0 32px 72px rgba(0,0,0,.45);padding:18px;">' +
      '<div style="font-size:10px;letter-spacing:.24em;text-transform:uppercase;color:#8f5c18;margin-bottom:8px;">Name this pin</div>' +
      '<input data-picker-label-input type="text" maxlength="200" style="box-sizing:border-box;width:100%;max-width:100%;min-width:0;min-height:46px;padding:11px 12px;border-radius:12px;border:1px solid rgba(56,46,31,.16);background:rgba(255,255,255,.62);color:#1f1b15;font:inherit;outline:none;margin-bottom:12px;" />' +
      '<div style="font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:#7a6749;margin-bottom:6px;">Snapshot preview</div>' +
      '<div data-picker-label-value style="min-height:88px;max-height:140px;overflow:auto;padding:12px;border-radius:14px;border:1px solid rgba(56,46,31,.12);background:rgba(255,255,255,.55);color:#2b2418;font-size:13px;line-height:1.55;margin-bottom:14px;"></div>' +
      '<div style="display:flex;justify-content:flex-end;gap:8px;">' +
      '<button type="button" data-picker-label-cancel style="border:1px solid rgba(56,46,31,.18);border-radius:999px;background:transparent;color:#2b2418;padding:8px 12px;cursor:pointer;">Back</button>' +
      '<button type="button" data-picker-label-save style="border:0;border-radius:999px;background:#1d4e43;color:#f4efe6;padding:8px 14px;font-weight:800;cursor:pointer;">Save pin</button>' +
      '</div>' +
      '</div>';

    savedPinsList = instructionDock.querySelector('[data-picker-saved-list]');
    statusLine = instructionDock.querySelector('[data-picker-status]');
    labelInput = labelEditor.querySelector('[data-picker-label-input]');
    labelValue = labelEditor.querySelector('[data-picker-label-value]');

    overlayRoot.appendChild(highlightBox);
    overlayRoot.appendChild(instructionDock);
    overlayRoot.appendChild(labelEditor);
    document.documentElement.appendChild(overlayRoot);

    instructionDock.addEventListener('click', onDockClick, true);
    labelEditor.addEventListener('click', onLabelEditorClick, true);
    labelEditor.addEventListener('keydown', onLabelEditorKeyDown, true);
  }

  function renderSavedPins() {
    if (!savedPinsList) {
      return;
    }

    if (!savedPins.length) {
      savedPinsList.innerHTML =
        '<div style="padding:12px;border-radius:14px;border:1px dashed rgba(255,245,222,.14);color:rgba(247,238,220,.62);font-size:12px;line-height:1.5;">Nothing saved in this session yet. Click any meaningful content on the page to capture it.</div>';
      return;
    }

    savedPinsList.innerHTML = savedPins
      .map(function (pin) {
        return (
          '<div style="display:grid;gap:4px;padding:11px 12px;border-radius:14px;border:1px solid rgba(255,245,222,.12);background:rgba(255,255,255,.04);">' +
          '<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">' +
          '<strong style="font-size:13px;color:#fff6e5;">' + escapeHtml(pin.title) + '</strong>' +
          '<span style="font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#d7a24f;">Saved</span>' +
          '</div>' +
          '<div style="font-size:12px;line-height:1.45;color:rgba(247,238,220,.72);">' +
          escapeHtml(pin.previewText || pin.savedContent || '') +
          '</div>' +
          '</div>'
        );
      })
      .join('');
  }

  function setPickerEnabled(nextEnabled) {
    pickerEnabled = nextEnabled;
    var toggleButton = instructionDock.querySelector('[data-picker-toggle]');
    if (toggleButton) {
      toggleButton.textContent = pickerEnabled ? 'Pause' : 'Resume';
    }

    if (!pickerEnabled) {
      highlightBox.style.opacity = '0';
      setStatus('Picker paused. Resume when you are ready to select more content.', 'idle');
    } else {
      setStatus('Picker live. Click visible content to save a pin.', 'idle');
    }
  }

  function openLabelEditor(candidate) {
    activeCandidate = candidate;
    labelEditor.style.display = 'flex';
    labelInput.value = candidate.label || '';
    labelValue.textContent = candidate.valueText || '(empty)';
    window.setTimeout(function () {
      labelInput.focus();
      labelInput.select();
    }, 0);
  }

  function closeLabelEditor() {
    activeCandidate = null;
    labelEditor.style.display = 'none';
  }

  async function saveCandidate() {
    if (!activeCandidate) {
      return;
    }

    var label = normalizeWhitespace(labelInput.value) || activeCandidate.label;
    setStatus('Saving pin...', 'idle');

    try {
      var metadata = readPageMetadata();
      var response = await sendMessage({
        type: 'PICKER_SAVE_PIN',
        pageUrl: metadata.pageUrl,
        pageTitle: metadata.pageTitle,
        faviconUrl: metadata.faviconUrl,
        field: {
          label: label,
          selector: activeCandidate.selector,
          valueText: activeCandidate.valueText,
        },
      });

      if (!response || !response.ok || !response.pin) {
        throw new Error((response && response.error) || 'Could not save the pin');
      }

      savedPins.unshift(response.pin);
      savedPins = savedPins.slice(0, 8);
      renderSavedPins();
      closeLabelEditor();
      setStatus('Saved "' + response.pin.title + '". Click something else or finish.', 'success');

      if (response.sessionComplete) {
        await finishSelection();
      }
    } catch (error) {
      setStatus(error.message, 'error');
    }
  }

  async function finishSelection() {
    try {
      await sendMessage({
        type: 'PICKER_SESSION_END',
      });
    } catch (_error) {}

    cleanup();
  }

  async function cancelSelection(message) {
    try {
      await sendMessage({
        type: 'PICKER_CANCEL',
        error: message || 'Pin capture cancelled',
      });
    } catch (_error) {}

    cleanup();
  }

  function cleanup() {
    if (!active) {
      return;
    }

    active = false;
    window.__PINBOARD_PICKER_ACTIVE__ = false;
    document.removeEventListener('mousemove', onPointerMove, true);
    document.removeEventListener('click', onPointerClick, true);
    document.removeEventListener('keydown', onKeyDown, true);

    if (overlayRoot && overlayRoot.parentNode) {
      overlayRoot.parentNode.removeChild(overlayRoot);
    }
  }

  function setHighlight(target) {
    if (!target || target === document.documentElement || target === document.body) {
      highlightBox.style.opacity = '0';
      return;
    }

    var rect = target.getBoundingClientRect();
    if (!rect || rect.width < 2 || rect.height < 2) {
      highlightBox.style.opacity = '0';
      return;
    }

    highlightBox.style.opacity = '1';
    highlightBox.style.transform =
      'translate(' + Math.max(0, rect.left) + 'px,' + Math.max(0, rect.top) + 'px)';
    highlightBox.style.width = Math.max(0, rect.width) + 'px';
    highlightBox.style.height = Math.max(0, rect.height) + 'px';
  }

  function onPointerMove(event) {
    if (!active || !pickerEnabled || labelEditor.style.display === 'flex') {
      return;
    }

    if (overlayRoot && overlayRoot.contains(event.target)) {
      return;
    }

    var target = document.elementFromPoint(event.clientX, event.clientY);
    if (!target || target === instructionDock || instructionDock.contains(target)) {
      return;
    }

    setHighlight(target);
  }

  function onPointerClick(event) {
    if (!active || !pickerEnabled || labelEditor.style.display === 'flex') {
      return;
    }

    if (overlayRoot && overlayRoot.contains(event.target)) {
      return;
    }

    var target = document.elementFromPoint(event.clientX, event.clientY);
    if (!target || target === instructionDock || instructionDock.contains(target)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    var selectableTarget = target.nodeType === 1 ? target : target.parentElement;
    var candidate = serializeCandidate(selectableTarget);

    if (!candidate.selector) {
      setStatus('This element cannot be saved reliably. Try a more specific item.', 'error');
      return;
    }

    if (!isMeaningfulText(candidate.valueText)) {
      setStatus('Choose text, a label, or a value with readable content.', 'error');
      return;
    }

    openLabelEditor(candidate);
  }

  function onKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (labelEditor.style.display === 'flex') {
        closeLabelEditor();
        setStatus('Capture not saved yet. Click the page to choose another item.', 'idle');
        return;
      }

      cancelSelection('Pin capture cancelled');
    }
  }

  function onDockClick(event) {
    var toggleButton = event.target.closest('[data-picker-toggle]');
    if (toggleButton) {
      setPickerEnabled(!pickerEnabled);
      return;
    }

    var doneButton = event.target.closest('[data-picker-done]');
    if (doneButton) {
      finishSelection();
      return;
    }

    var cancelButton = event.target.closest('[data-picker-cancel]');
    if (cancelButton) {
      cancelSelection('Pin capture cancelled');
    }
  }

  function onLabelEditorClick(event) {
    var cancelButton = event.target.closest('[data-picker-label-cancel]');
    if (cancelButton) {
      closeLabelEditor();
      setStatus('Capture not saved yet. Click the page to choose another item.', 'idle');
      return;
    }

    var saveButton = event.target.closest('[data-picker-label-save]');
    if (saveButton) {
      saveCandidate();
    }
  }

  function onLabelEditorKeyDown(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      saveCandidate();
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      closeLabelEditor();
      setStatus('Capture not saved yet. Click the page to choose another item.', 'idle');
    }
  }

  ensureOverlay();
  renderSavedPins();
  setPickerEnabled(true);
  setStatus('Picker live. Click visible content to save a pin.', 'idle');
  document.addEventListener('mousemove', onPointerMove, true);
  document.addEventListener('click', onPointerClick, true);
  document.addEventListener('keydown', onKeyDown, true);
})();
