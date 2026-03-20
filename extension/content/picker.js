(function () {
  'use strict';

  var overlayRoot = null;
  var highlightBox = null;
  var instructionDock = null;
  var labelEditor = null;
  var labelInput = null;
  var labelValue = null;
  var pendingFieldsList = null;
  var pendingFields = [];
  var activeCandidate = null;
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
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function readPageMetadata() {
    var iconLink = document.querySelector(
      'link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]'
    );

    return {
      title: document.title ? document.title.trim() : '',
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

  function suggestFieldLabel(node, valueText, index) {
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

    for (var i = 0; i < candidates.length; i += 1) {
      var candidate = normalizeWhitespace(candidates[i]);
      if (candidate && candidate.length <= 42) {
        return candidate;
      }
    }

    return 'Field ' + (index + 1);
  }

  function serializeFieldCandidate(element, index) {
    var valueText = readFieldValue(element);
    var selector = makeAbsoluteSelector(element);

    return {
      id: 'candidate-' + Date.now().toString(36) + '-' + index,
      label: suggestFieldLabel(element, valueText, index),
      selector: selector,
      valueText: valueText,
    };
  }

  function ensureOverlay() {
    if (overlayRoot) {
      return;
    }

    overlayRoot = document.createElement('div');
    overlayRoot.id = '__ai_usage_picker_overlay__';
    overlayRoot.style.cssText =
      'position:fixed;inset:0;z-index:2147483647;pointer-events:none;font-family:Georgia,serif;';

    highlightBox = document.createElement('div');
    highlightBox.style.cssText =
      'position:fixed;left:0;top:0;width:0;height:0;pointer-events:none;border:2px solid #f0b35f;background:rgba(240,179,95,.14);box-shadow:0 0 0 1px rgba(0,0,0,.6),0 14px 30px rgba(0,0,0,.35);border-radius:12px;transition:transform 120ms ease,opacity 120ms ease;opacity:0;';

    instructionDock = document.createElement('div');
    instructionDock.style.cssText =
      'position:fixed;right:16px;bottom:16px;max-width:min(380px,calc(100vw - 32px));padding:14px 16px;border-radius:16px;border:1px solid rgba(255,255,255,.14);background:rgba(8,10,14,.92);backdrop-filter:blur(18px);color:#f4f7fb;box-shadow:0 24px 50px rgba(0,0,0,.45);pointer-events:auto;';
    instructionDock.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px;">' +
      '<strong style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;">Pick fields</strong>' +
      '<div style="display:flex;gap:8px;align-items:center;">' +
      '<span data-ai-usage-picker-status style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;padding:5px 10px;border-radius:999px;border:1px solid rgba(242,177,91,.28);color:#f2b15b;background:rgba(242,177,91,.08);">Live</span>' +
      '<button type="button" data-ai-usage-picker-toggle style="border:1px solid rgba(255,255,255,.14);border-radius:999px;background:transparent;color:#f4f7fb;padding:6px 12px;font-weight:700;cursor:pointer;">Pause picker</button>' +
      '<button type="button" data-ai-usage-picker-finish style="border:0;border-radius:999px;background:#f2b15b;color:#11131a;padding:6px 12px;font-weight:700;cursor:pointer;">Finish</button>' +
      '</div>' +
      '</div>' +
      '<div style="font-size:13px;line-height:1.5;color:rgba(244,247,251,.82);margin-bottom:10px;">Click a specific number, label, or stat on the page. Pause the picker when you need to interact with the site, then resume to capture more fields.</div>' +
      '<div data-ai-usage-picker-fields style="display:grid;gap:8px;max-height:180px;overflow:auto;padding-right:2px;"></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px;">' +
      '<button type="button" data-ai-usage-picker-cancel style="border:1px solid rgba(255,255,255,.14);border-radius:999px;background:transparent;color:#f4f7fb;padding:6px 12px;cursor:pointer;">Cancel</button>' +
      '</div>';

    labelEditor = document.createElement('div');
    labelEditor.style.cssText =
      'position:fixed;inset:0;display:none;align-items:center;justify-content:center;pointer-events:auto;background:rgba(3,5,8,.44);backdrop-filter:blur(6px);';
    labelEditor.innerHTML =
      '<div style="width:min(420px,calc(100vw - 32px));border-radius:18px;border:1px solid rgba(255,255,255,.12);background:rgba(12,16,24,.98);box-shadow:0 28px 60px rgba(0,0,0,.5);padding:16px;">' +
      '<div style="font-size:10px;letter-spacing:.24em;text-transform:uppercase;color:#f2b15b;margin-bottom:10px;">Name field</div>' +
      '<input data-ai-usage-picker-label-input type="text" maxlength="120" style="width:100%;min-height:44px;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:#0a1018;color:#f4f7fb;font:inherit;outline:none;margin-bottom:10px;" />' +
      '<div data-ai-usage-picker-label-value style="min-height:72px;max-height:120px;overflow:auto;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);color:#c7d0db;font-size:13px;line-height:1.5;margin-bottom:12px;"></div>' +
      '<div style="display:flex;justify-content:flex-end;gap:8px;">' +
      '<button type="button" data-ai-usage-picker-label-cancel style="border:1px solid rgba(255,255,255,.14);border-radius:999px;background:transparent;color:#f4f7fb;padding:8px 12px;cursor:pointer;">Cancel</button>' +
      '<button type="button" data-ai-usage-picker-label-save style="border:0;border-radius:999px;background:#f2b15b;color:#11131a;padding:8px 12px;font-weight:700;cursor:pointer;">Add field</button>' +
      '</div>' +
      '</div>';

    pendingFieldsList = instructionDock.querySelector('[data-ai-usage-picker-fields]');
    labelInput = labelEditor.querySelector('[data-ai-usage-picker-label-input]');
    labelValue = labelEditor.querySelector('[data-ai-usage-picker-label-value]');

    overlayRoot.appendChild(highlightBox);
    overlayRoot.appendChild(instructionDock);
    overlayRoot.appendChild(labelEditor);
    document.documentElement.appendChild(overlayRoot);

    instructionDock.addEventListener('click', onDockClick, true);
    labelEditor.addEventListener('click', onLabelEditorClick, true);
  }

  function setPickerEnabled(nextEnabled) {
    pickerEnabled = nextEnabled;
    var toggleButton = instructionDock.querySelector('[data-ai-usage-picker-toggle]');
    var statusBadge = instructionDock.querySelector('[data-ai-usage-picker-status]');
    if (toggleButton) {
      toggleButton.textContent = pickerEnabled ? 'Pause picker' : 'Resume picker';
    }
    if (statusBadge) {
      statusBadge.textContent = pickerEnabled ? 'Live' : 'Paused';
      statusBadge.style.borderColor = pickerEnabled ? 'rgba(242,177,91,.28)' : 'rgba(115,136,160,.28)';
      statusBadge.style.color = pickerEnabled ? '#f2b15b' : '#8fa0b5';
      statusBadge.style.background = pickerEnabled ? 'rgba(242,177,91,.08)' : 'rgba(143,160,181,.08)';
    }

    if (!pickerEnabled) {
      highlightBox.style.opacity = '0';
    }
  }

  function renderPendingFields() {
    if (!pendingFieldsList) {
      return;
    }

    if (!pendingFields.length) {
      pendingFieldsList.innerHTML =
        '<div style="padding:10px 12px;border-radius:12px;border:1px dashed rgba(255,255,255,.12);color:#8f99a8;font-size:12px;line-height:1.5;">No fields selected yet.</div>';
      return;
    }

    pendingFieldsList.innerHTML = pendingFields
      .map(function (field, index) {
        return (
          '<div data-ai-usage-picker-field-id="' +
          field.id +
          '" style="display:grid;gap:6px;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);">' +
          '<div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;">' +
          '<strong style="font-size:13px;color:#f4f7fb;">' + escapeHtml(field.label) + '</strong>' +
          '<button type="button" data-ai-usage-picker-remove-field="' +
          field.id +
          '" style="border:0;background:transparent;color:#ffb0b0;cursor:pointer;font-size:12px;">Remove</button>' +
          '</div>' +
          '<div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8fa0b5;">' +
          escapeHtml(field.valueText || 'No text') +
          '</div>' +
          '</div>'
        );
      })
      .join('');
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

  function addCandidateField() {
    if (!activeCandidate) {
      return;
    }

    var label = normalizeWhitespace(labelInput.value) || activeCandidate.label;
    pendingFields.push({
      id: activeCandidate.id,
      label: label,
      selector: activeCandidate.selector,
      valueText: activeCandidate.valueText,
    });
    renderPendingFields();
    closeLabelEditor();
  }

  function finishSelection() {
    if (!pendingFields.length) {
      cleanup(false, { error: 'Select at least one field' });
      return;
    }

    var metadata = readPageMetadata();
    cleanup(true, {
      pageUrl: metadata.pageUrl,
      title: metadata.title,
      faviconUrl: metadata.faviconUrl,
      fields: pendingFields,
    });
  }

  function cleanup(ok, payload) {
    if (!active) {
      return;
    }

    active = false;
    document.removeEventListener('mousemove', onPointerMove, true);
    document.removeEventListener('click', onPointerClick, true);
    document.removeEventListener('keydown', onKeyDown, true);

    if (overlayRoot && overlayRoot.parentNode) {
      overlayRoot.parentNode.removeChild(overlayRoot);
    }

    if (ok) {
      chrome.runtime.sendMessage(
        Object.assign(
          {
            type: 'PICKER_RESULT',
            ok: true,
          },
          payload
        )
      );
    } else {
      chrome.runtime.sendMessage({
        type: 'PICKER_CANCEL',
        ok: false,
        error: payload && payload.error ? payload.error : 'Selection cancelled',
      });
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
    var selector = makeAbsoluteSelector(selectableTarget);
    if (!selector) {
      cleanup(false, { error: 'Could not compute selector' });
      return;
    }

    var candidate = serializeFieldCandidate(selectableTarget, pendingFields.length);
    candidate.selector = selector;
    openLabelEditor(candidate);
  }

  function onKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (labelEditor.style.display === 'flex') {
        closeLabelEditor();
        return;
      }
      cleanup(false, { error: 'Selection cancelled' });
    }
  }

  function onDockClick(event) {
    var toggleButton = event.target.closest('[data-ai-usage-picker-toggle]');
    if (toggleButton) {
      setPickerEnabled(!pickerEnabled);
      return;
    }

    var removeButton = event.target.closest('[data-ai-usage-picker-remove-field]');
    if (removeButton) {
      var id = removeButton.getAttribute('data-ai-usage-picker-remove-field');
      pendingFields = pendingFields.filter(function (field) {
        return field.id !== id;
      });
      renderPendingFields();
      return;
    }

    var finishButton = event.target.closest('[data-ai-usage-picker-finish]');
    if (finishButton) {
      finishSelection();
      return;
    }

    var cancelButton = event.target.closest('[data-ai-usage-picker-cancel]');
    if (cancelButton) {
      cleanup(false, { error: 'Selection cancelled' });
    }
  }

  function onLabelEditorClick(event) {
    var cancelButton = event.target.closest('[data-ai-usage-picker-label-cancel]');
    if (cancelButton) {
      closeLabelEditor();
      return;
    }

    var saveButton = event.target.closest('[data-ai-usage-picker-label-save]');
    if (saveButton) {
      addCandidateField();
    }
  }

  ensureOverlay();
  renderPendingFields();
  setPickerEnabled(true);
  document.addEventListener('mousemove', onPointerMove, true);
  document.addEventListener('click', onPointerClick, true);
  document.addEventListener('keydown', onKeyDown, true);
})();
