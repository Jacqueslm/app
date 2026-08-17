/*
 * LeadCatch embed widget.
 *
 * The whole install is one line on the customer's website:
 *   <script src="https://YOUR-HOST/embed.js" data-form="PUBLIC_KEY" async></script>
 *
 * Options on the script tag:
 *   data-form    (required) the form's public key
 *   data-mode    "inline" (default) renders where the tag sits;
 *                "button" adds a floating tab that opens the form in a dialog
 *   data-target  CSS selector to render into instead of next to the tag
 *   data-label   text on the floating button (button mode)
 *
 * Everything renders inside a shadow root. That is not decoration: without it
 * the host site's CSS reaches in and a form looks broken on exactly the sites
 * we can't test. Nothing here touches the host page's globals either.
 */
(function () {
  'use strict';

  var script = document.currentScript;
  if (!script) return;

  var formKey = script.getAttribute('data-form');
  if (!formKey) {
    console.warn('[LeadCatch] Missing data-form on the embed script tag.');
    return;
  }
  var mode = script.getAttribute('data-mode') === 'button' ? 'button' : 'inline';
  var targetSelector = script.getAttribute('data-target');
  var buttonLabel = script.getAttribute('data-label') || 'Contact us';

  // The API lives wherever this script was served from, so the snippet has no
  // second URL for the customer to get wrong.
  var base = script.src.replace(/\/embed\.js(\?.*)?$/, '');

  var STYLE = [
    ':host{all:initial}',
    '*{box-sizing:border-box;font-family:inherit}',
    '.lc-form{font-family:system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;',
    'font-size:16px;line-height:1.5;color:#111827;max-width:32rem}',
    '.lc-headline{font-size:1.25rem;font-weight:650;margin:0 0 .25rem}',
    '.lc-intro{margin:0 0 1rem;color:#4b5563;font-size:.95rem}',
    '.lc-field{margin-bottom:.75rem}',
    '.lc-label{display:block;font-size:.85rem;font-weight:600;margin-bottom:.25rem;color:#374151}',
    '.lc-req{color:#dc2626}',
    '.lc-input,.lc-textarea,.lc-select{width:100%;padding:.6rem .7rem;border:1px solid #d1d5db;border-radius:.5rem;',
    'font-size:1rem;color:#111827;background:#fff;font-family:inherit}',
    '.lc-input:focus,.lc-textarea:focus,.lc-select:focus{outline:2px solid var(--lc-accent,#2563eb);outline-offset:1px;border-color:transparent}',
    '.lc-textarea{min-height:6rem;resize:vertical}',
    '.lc-button{width:100%;padding:.7rem 1rem;border:0;border-radius:.5rem;background:var(--lc-accent,#2563eb);',
    'color:#fff;font-size:1rem;font-weight:600;cursor:pointer;font-family:inherit}',
    '.lc-button:hover{filter:brightness(.94)}',
    '.lc-button[disabled]{opacity:.6;cursor:progress}',
    '.lc-error{margin:.5rem 0 0;color:#b91c1c;font-size:.9rem}',
    '.lc-done{padding:1rem;border:1px solid #bbf7d0;background:#f0fdf4;border-radius:.5rem;color:#166534}',
    '.lc-hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}',
    // Floating-button mode
    '.lc-fab{position:fixed;right:1rem;bottom:1rem;z-index:2147483000;padding:.75rem 1.15rem;border:0;',
    'border-radius:999px;background:var(--lc-accent,#2563eb);color:#fff;font-weight:650;font-size:1rem;',
    'cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.22);font-family:system-ui,-apple-system,sans-serif}',
    '.lc-overlay{position:fixed;inset:0;z-index:2147483001;background:rgba(15,23,42,.5);display:flex;',
    'align-items:center;justify-content:center;padding:1rem;overflow:auto}',
    '.lc-modal{background:#fff;border-radius:.9rem;padding:1.5rem;width:100%;max-width:30rem;position:relative;',
    'max-height:90vh;overflow:auto}',
    '.lc-close{position:absolute;top:.5rem;right:.6rem;border:0;background:none;font-size:1.6rem;line-height:1;',
    'cursor:pointer;color:#6b7280;padding:.25rem .5rem}',
    '@media (prefers-color-scheme:dark){',
    '.lc-form{color:#f3f4f6}.lc-intro{color:#9ca3af}.lc-label{color:#d1d5db}',
    '.lc-input,.lc-textarea,.lc-select{background:#111827;border-color:#374151;color:#f3f4f6}',
    '.lc-modal{background:#1f2937}',
    '.lc-done{background:#052e16;border-color:#166534;color:#bbf7d0}}',
  ].join('');

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    // textContent, never innerHTML: the headline, labels and success message
    // are owner-supplied strings and must never be parsed as markup.
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function buildForm(config, host) {
    var wrap = el('div', 'lc-form');
    wrap.style.setProperty('--lc-accent', config.accent_color || '#2563eb');

    if (config.headline) wrap.appendChild(el('h3', 'lc-headline', config.headline));
    if (config.intro) wrap.appendChild(el('p', 'lc-intro', config.intro));

    var form = el('form');
    var controls = {};

    function addField(key, spec, inputTag, type) {
      if (!spec || !spec.show) return;
      var field = el('div', 'lc-field');
      var id = 'lc-' + key;
      var label = el('label', 'lc-label', spec.label);
      label.setAttribute('for', id);
      if (spec.required) {
        var star = el('span', 'lc-req', ' *');
        label.appendChild(star);
      }
      var input = el(inputTag, inputTag === 'textarea' ? 'lc-textarea' : 'lc-input');
      input.id = id;
      input.name = key;
      if (type) input.type = type;
      if (spec.required) input.required = true;
      if (key === 'email') input.autocomplete = 'email';
      if (key === 'phone') input.autocomplete = 'tel';
      if (key === 'name') input.autocomplete = 'name';
      field.appendChild(label);
      field.appendChild(input);
      form.appendChild(field);
      controls[key] = input;
    }

    var fields = config.fields || {};
    addField('name', fields.name, 'input', 'text');
    addField('email', fields.email, 'input', 'email');
    addField('phone', fields.phone, 'input', 'tel');
    addField('message', fields.message, 'textarea');

    var customInputs = [];
    (fields.custom || []).forEach(function (spec, i) {
      var field = el('div', 'lc-field');
      var id = 'lc-custom-' + i;
      var label = el('label', 'lc-label', spec.label);
      label.setAttribute('for', id);
      if (spec.required) label.appendChild(el('span', 'lc-req', ' *'));
      var input;
      if (spec.type === 'select') {
        input = el('select', 'lc-select');
        input.appendChild(el('option', null, ''));
        (spec.options || []).forEach(function (opt) {
          var option = el('option', null, opt);
          option.value = opt;
          input.appendChild(option);
        });
      } else {
        input = el('input', 'lc-input');
        input.type = 'text';
      }
      input.id = id;
      if (spec.required) input.required = true;
      field.appendChild(label);
      field.appendChild(input);
      form.appendChild(field);
      customInputs.push({ label: spec.label, input: input });
    });

    // The honeypot. Hidden off-screen and unlabelled for people; bots that fill
    // in every input they find give themselves away here.
    var trap = el('div', 'lc-hp');
    var trapInput = el('input');
    trapInput.type = 'text';
    trapInput.name = 'company_website';
    trapInput.tabIndex = -1;
    trapInput.setAttribute('autocomplete', 'off');
    trapInput.setAttribute('aria-hidden', 'true');
    trap.appendChild(trapInput);
    form.appendChild(trap);

    var button = el('button', 'lc-button', config.button_text || 'Send');
    button.type = 'submit';
    form.appendChild(button);

    var error = el('p', 'lc-error');
    error.setAttribute('role', 'alert');
    error.hidden = true;
    form.appendChild(error);

    var openedAt = Date.now();

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      error.hidden = true;
      button.disabled = true;
      var original = button.textContent;
      button.textContent = 'Sending…';

      var payload = {
        _hp: trapInput.value,
        _t: Date.now() - openedAt,
        source_url: location.href.slice(0, 500),
        referrer: document.referrer ? document.referrer.slice(0, 500) : null,
        custom: {},
      };
      Object.keys(controls).forEach(function (key) {
        payload[key] = controls[key].value;
      });
      customInputs.forEach(function (entry) {
        payload.custom[entry.label] = entry.input.value;
      });

      fetch(base + '/api/public/form/' + encodeURIComponent(formKey) + '/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(function (res) {
          return res.json().then(function (data) {
            return { ok: res.ok, data: data };
          });
        })
        .then(function (result) {
          if (!result.ok) throw new Error((result.data && result.data.error) || 'Something went wrong.');
          var done = el('div', 'lc-done', result.data.message || config.success_message || 'Thanks!');
          wrap.textContent = '';
          wrap.appendChild(done);
          host.dispatchEvent(new CustomEvent('leadcatch:submitted', { bubbles: true }));
        })
        .catch(function (err) {
          error.textContent = err.message || 'Something went wrong. Please try again.';
          error.hidden = false;
          button.disabled = false;
          button.textContent = original;
        });
    });

    wrap.appendChild(form);
    return wrap;
  }

  function mount(config) {
    var host = document.createElement('div');
    host.setAttribute('data-leadcatch', formKey);
    var root = host.attachShadow({ mode: 'open' });
    var style = document.createElement('style');
    style.textContent = STYLE;
    root.appendChild(style);

    if (mode === 'button') {
      document.body.appendChild(host);
      var fab = el('button', 'lc-fab', buttonLabel);
      fab.style.setProperty('--lc-accent', config.accent_color || '#2563eb');
      fab.addEventListener('click', function () {
        var overlay = el('div', 'lc-overlay');
        var modal = el('div', 'lc-modal');
        var close = el('button', 'lc-close', '×');
        close.setAttribute('aria-label', 'Close');
        function dismiss() {
          overlay.remove();
          fab.hidden = false;
          document.removeEventListener('keydown', onKey);
        }
        function onKey(ev) {
          if (ev.key === 'Escape') dismiss();
        }
        close.addEventListener('click', dismiss);
        overlay.addEventListener('click', function (ev) {
          if (ev.target === overlay) dismiss();
        });
        document.addEventListener('keydown', onKey);
        modal.appendChild(close);
        modal.appendChild(buildForm(config, host));
        overlay.appendChild(modal);
        root.appendChild(overlay);
        fab.hidden = true;
        var firstInput = modal.querySelector('input, textarea, select');
        if (firstInput) firstInput.focus();
      });
      root.appendChild(fab);
      return;
    }

    var target = targetSelector ? document.querySelector(targetSelector) : null;
    if (target) target.appendChild(host);
    else if (script.parentNode) script.parentNode.insertBefore(host, script.nextSibling);
    else document.body.appendChild(host);
    root.appendChild(buildForm(config, host));
  }

  fetch(base + '/api/public/form/' + encodeURIComponent(formKey))
    .then(function (res) {
      if (!res.ok) throw new Error('This form is not available.');
      return res.json();
    })
    .then(mount)
    .catch(function (err) {
      // Never render an error into a customer's live page - a broken form key
      // should look like nothing at all to their visitors, and like a console
      // warning to whoever installed it.
      console.warn('[LeadCatch] ' + err.message);
    });
})();
