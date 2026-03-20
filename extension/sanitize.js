(function (global) {
  'use strict';

  var MAX_PREVIEW_HTML_LENGTH = 500000;

  function stripDangerousAttributes(html) {
    return html.replace(/\s([a-zA-Z0-9:-]+)\s*=\s*("([^"]*)"|'([^']*)'|[^\s>]+)/g, function (match, name, quotedValue, doubleValue, singleValue) {
      var lowerName = String(name).toLowerCase();
      var value = doubleValue || singleValue || quotedValue || '';

      if (lowerName.indexOf('on') === 0) {
        return '';
      }

      if (lowerName === 'srcdoc') {
        return '';
      }

      if ((lowerName === 'href' || lowerName === 'src' || lowerName === 'action' || lowerName === 'formaction') && /^\s*javascript:/i.test(value)) {
        return '';
      }

      return match;
    });
  }

  function sanitizePreviewHtml(html) {
    if (typeof html !== 'string') {
      return '';
    }

    var output = html.slice(0, MAX_PREVIEW_HTML_LENGTH);
    output = output.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
    output = output.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '');
    output = output.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
    output = output.replace(/<link\b[^>]*>/gi, '');
    output = output.replace(/<base\b[^>]*>/gi, '');
    output = output.replace(/<meta\b[^>]*>/gi, '');
    output = output.replace(/<object\b[^>]*>[\s\S]*?<\/object>/gi, '');
    output = output.replace(/<embed\b[^>]*>/gi, '');
    output = stripDangerousAttributes(output);
    return output;
  }

  global.AIUsageSanitizer = {
    sanitizePreviewHtml: sanitizePreviewHtml,
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
