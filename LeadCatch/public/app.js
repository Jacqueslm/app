/* LeadCatch dashboard.
 *
 * Everything a lead contains was typed by a stranger on the internet, so this
 * file builds DOM nodes and assigns textContent. There is no innerHTML with
 * data anywhere in here, deliberately: a lead whose "name" is a <script> tag
 * must render as those characters, not run.
 */
(function () {
  'use strict';

  var PAGE_SIZE = 50;
  var STATUSES = [
    { value: 'new', label: 'New' },
    { value: 'contacted', label: 'Contacted' },
    { value: 'qualified', label: 'Quoted' },
    { value: 'won', label: 'Won' },
    { value: 'lost', label: 'Lost' },
  ];
  var STATUS_LABEL = STATUSES.reduce(function (acc, s) {
    acc[s.value] = s.label;
    return acc;
  }, {});

  var state = { forms: [], leads: [], total: 0, offset: 0, editing: null, customFields: [] };

  var $ = function (id) { return document.getElementById(id); };
  var globalError = $('global-error');

  function showError(message) {
    globalError.textContent = message;
    globalError.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function api(path, options) {
    var opts = options || {};
    return fetch(path, {
      method: opts.method || 'GET',
      headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    }).then(function (res) {
      // The 30-day cookie can outlive the account or the password behind it, so
      // any 401 means "start again at the front door" rather than an error box.
      if (res.status === 401) {
        location.href = '/#signin';
        throw new Error('Signed out.');
      }
      return res.json().then(
        function (data) {
          if (!res.ok) throw new Error(data.error || 'Something went wrong.');
          return data;
        },
        function () {
          throw new Error('Something went wrong.');
        }
      );
    });
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function relativeTime(iso) {
    var then = new Date(iso).getTime();
    if (!Number.isFinite(then)) return '';
    var seconds = Math.round((Date.now() - then) / 1000);
    if (seconds < 60) return 'just now';
    var minutes = Math.round(seconds / 60);
    if (minutes < 60) return minutes + ' min ago';
    var hours = Math.round(minutes / 60);
    if (hours < 24) return hours === 1 ? 'an hour ago' : hours + ' hours ago';
    var days = Math.round(hours / 24);
    if (days < 7) return days === 1 ? 'yesterday' : days + ' days ago';
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  /* ------------------------------------------------------------ navigation */

  function switchView(name) {
    ['leads', 'forms', 'settings'].forEach(function (view) {
      $('view-' + view).hidden = view !== name;
    });
    document.querySelectorAll('.nav button[data-view]').forEach(function (button) {
      if (button.dataset.view === name) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    globalError.hidden = true;
    if (name === 'forms') renderForms();
  }

  document.addEventListener('click', function (ev) {
    var trigger = ev.target.closest('[data-view]');
    if (trigger) switchView(trigger.dataset.view);
  });

  $('signout').addEventListener('click', function () {
    api('/api/auth/logout', { method: 'POST' }).finally(function () {
      location.href = '/';
    });
  });

  /* ----------------------------------------------------------------- stats */

  function renderStats(stats) {
    var container = $('stats');
    container.textContent = '';

    var trend = '';
    if (stats.previous_7_days > 0) {
      var change = Math.round(((stats.last_7_days - stats.previous_7_days) / stats.previous_7_days) * 100);
      trend = (change >= 0 ? '+' : '') + change + '% vs previous 7 days';
    } else if (stats.last_7_days > 0) {
      trend = 'first leads this week';
    }

    var tiles = [
      { k: 'New', n: stats.counts.new, note: 'waiting on you' },
      { k: 'Last 7 days', n: stats.last_7_days, note: trend },
      { k: 'Won', n: stats.counts.won, note: stats.won_value_cents ? formatMoney(stats.won_value_cents) + ' booked' : '' },
      { k: 'All leads', n: stats.total, note: '' },
    ];
    tiles.forEach(function (tile) {
      var box = el('div', 'stat');
      box.appendChild(el('div', 'n', String(tile.n)));
      box.appendChild(el('div', 'k', tile.k));
      if (tile.note) box.appendChild(el('div', 'small muted', tile.note));
      container.appendChild(box);
    });

    // 30-day sparkline. Zero-fills missing days so a quiet week reads as a gap
    // rather than compressing the chart into a lie.
    if (stats.total > 0) {
      var counts = {};
      stats.daily.forEach(function (row) { counts[row.day] = row.n; });
      var peak = Math.max.apply(null, stats.daily.map(function (r) { return r.n; }).concat([1]));
      var chart = el('div', 'stat');
      chart.style.gridColumn = '1 / -1';
      chart.appendChild(el('div', 'k', 'Leads per day, last 30 days'));
      var spark = el('div', 'sparkline');
      for (var i = 29; i >= 0; i--) {
        var day = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
        var n = counts[day] || 0;
        var bar = el('div');
        bar.style.height = Math.max((n / peak) * 100, 2) + '%';
        bar.style.opacity = n ? '0.85' : '0.15';
        bar.title = day + ': ' + n + (n === 1 ? ' lead' : ' leads');
        spark.appendChild(bar);
      }
      chart.appendChild(spark);
      container.appendChild(chart);
    }
  }

  function formatMoney(cents) {
    return (cents / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  }

  /* ----------------------------------------------------------------- leads */

  function currentFilters() {
    var params = new URLSearchParams();
    var q = $('search').value.trim();
    if (q) params.set('q', q);
    if ($('filter-status').value) params.set('status', $('filter-status').value);
    if ($('filter-form').value) params.set('form_id', $('filter-form').value);
    return params;
  }

  function loadLeads(append) {
    var params = currentFilters();
    state.offset = append ? state.offset + PAGE_SIZE : 0;
    params.set('limit', String(PAGE_SIZE));
    params.set('offset', String(state.offset));
    return api('/api/leads?' + params.toString()).then(function (data) {
      state.leads = append ? state.leads.concat(data.leads) : data.leads;
      state.total = data.total;
      renderLeads();
    });
  }

  function renderLeads() {
    var list = $('lead-list');
    list.textContent = '';
    var filtering = Boolean(currentFilters().toString());
    $('leads-empty').hidden = state.leads.length > 0 || filtering;

    if (!state.leads.length && filtering) {
      list.appendChild(el('p', 'empty', 'No leads match that.'));
    }
    state.leads.forEach(function (lead) {
      list.appendChild(renderLead(lead));
    });
    $('load-more').hidden = state.leads.length >= state.total;
  }

  function renderLead(lead) {
    var card = el('div', 'lead');
    card.dataset.id = String(lead.id);

    var top = el('div', 'lead-top');
    var who = el('div');
    who.appendChild(el('div', 'lead-name', lead.name || lead.email || lead.phone || 'Unnamed lead'));

    var contact = el('div', 'lead-contact');
    if (lead.phone) {
      var tel = el('a', null, lead.phone);
      tel.href = 'tel:' + lead.phone.replace(/[^\d+]/g, '');
      contact.appendChild(tel);
    }
    if (lead.email) {
      var mail = el('a', null, lead.email);
      mail.href = 'mailto:' + encodeURIComponent(lead.email);
      contact.appendChild(mail);
    }
    if (contact.childNodes.length) who.appendChild(contact);
    top.appendChild(who);

    var meta = el('div', 'lead-meta');
    var pill = el('span', 'pill ' + lead.status, STATUS_LABEL[lead.status] || lead.status);
    meta.appendChild(pill);
    var when = el('div', null, relativeTime(lead.created_at));
    when.title = new Date(lead.created_at).toLocaleString();
    meta.appendChild(when);
    if (lead.form_name) meta.appendChild(el('div', null, lead.form_name));
    top.appendChild(meta);
    card.appendChild(top);

    if (lead.message) card.appendChild(el('p', 'lead-message', lead.message));

    if (lead.extra && Object.keys(lead.extra).length) {
      var extra = el('div', 'lead-extra');
      Object.keys(lead.extra).forEach(function (label) {
        extra.appendChild(el('div', null, label + ': ' + lead.extra[label]));
      });
      card.appendChild(extra);
    }

    var actions = el('div', 'lead-actions');
    var select = el('select');
    select.setAttribute('aria-label', 'Status');
    select.style.width = 'auto';
    STATUSES.forEach(function (status) {
      var option = el('option', null, status.label);
      option.value = status.value;
      if (status.value === lead.status) option.selected = true;
      select.appendChild(option);
    });
    select.addEventListener('change', function () {
      patchLead(lead, { status: select.value }, function (updated) {
        pill.textContent = STATUS_LABEL[updated.status];
        pill.className = 'pill ' + updated.status;
        value.hidden = updated.status !== 'won';
        loadStats();
      });
    });
    actions.appendChild(select);

    // Job value only appears once a lead is actually won - asking for it
    // earlier is guessing, and the "won" tile is the number that matters.
    var value = el('input');
    value.type = 'number';
    value.min = '0';
    value.step = '1';
    value.placeholder = 'Job value';
    value.style.width = '9rem';
    value.setAttribute('aria-label', 'Job value');
    if (lead.value_cents !== null && lead.value_cents !== undefined) value.value = String(lead.value_cents / 100);
    value.hidden = lead.status !== 'won';
    value.addEventListener('change', function () {
      var amount = value.value === '' ? null : Math.round(Number(value.value) * 100);
      patchLead(lead, { value_cents: amount }, loadStats);
    });
    actions.appendChild(value);

    var notesToggle = el('button', 'btn-ghost btn-sm', lead.notes ? 'Notes ✓' : 'Add note');
    var notes = el('textarea', 'lead-notes');
    notes.placeholder = 'What happened when you called?';
    notes.value = lead.notes || '';
    notes.hidden = !lead.notes;
    notesToggle.addEventListener('click', function () {
      notes.hidden = !notes.hidden;
      if (!notes.hidden) notes.focus();
    });
    notes.addEventListener('blur', function () {
      if (notes.value === (lead.notes || '')) return;
      patchLead(lead, { notes: notes.value }, function (updated) {
        notesToggle.textContent = updated.notes ? 'Notes ✓' : 'Add note';
      });
    });
    actions.appendChild(notesToggle);

    var remove = el('button', 'btn-ghost btn-sm', 'Delete');
    remove.addEventListener('click', function () {
      if (!confirm('Delete this lead? This cannot be undone.')) return;
      api('/api/leads/' + lead.id, { method: 'DELETE' })
        .then(function () {
          card.remove();
          state.leads = state.leads.filter(function (l) { return l.id !== lead.id; });
          state.total = Math.max(state.total - 1, 0);
          $('leads-empty').hidden = state.leads.length > 0 || Boolean(currentFilters().toString());
          loadStats();
        })
        .catch(function (err) { showError(err.message); });
    });
    actions.appendChild(remove);

    card.appendChild(actions);
    card.appendChild(notes);
    return card;
  }

  function patchLead(lead, patch, onDone) {
    api('/api/leads/' + lead.id, { method: 'PATCH', body: patch })
      .then(function (updated) {
        Object.assign(lead, updated);
        if (onDone) onDone(updated);
      })
      .catch(function (err) { showError(err.message); });
  }

  function loadStats() {
    return api('/api/stats').then(renderStats).catch(function () { /* tiles are not worth an error box */ });
  }

  var searchTimer;
  $('search').addEventListener('input', function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () { loadLeads(false).catch(function (e) { showError(e.message); }); }, 250);
  });
  $('filter-status').addEventListener('change', function () { loadLeads(false).catch(function (e) { showError(e.message); }); });
  $('filter-form').addEventListener('change', function () { loadLeads(false).catch(function (e) { showError(e.message); }); });
  $('load-more').addEventListener('click', function () { loadLeads(true).catch(function (e) { showError(e.message); }); });

  /* ----------------------------------------------------------------- forms */

  function snippetFor(form) {
    return '<script src="' + location.origin + '/embed.js" data-form="' + form.key + '" async><\/script>';
  }

  function copyButton(label, text) {
    var button = el('button', 'btn-secondary btn-sm', label);
    button.addEventListener('click', function () {
      var done = function () {
        var original = button.textContent;
        button.textContent = 'Copied';
        setTimeout(function () { button.textContent = original; }, 1500);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { window.prompt('Copy this:', text); });
      } else {
        window.prompt('Copy this:', text);
      }
    });
    return button;
  }

  function renderForms() {
    var list = $('form-list');
    list.textContent = '';
    if (!state.forms.length) {
      list.appendChild(el('p', 'empty', 'No forms yet. Create one to start collecting leads.'));
      return;
    }
    state.forms.forEach(function (form) {
      var card = el('div', 'form-card');

      var head = el('div', 'row');
      var title = el('div', 'grow');
      title.appendChild(el('h3', null, form.name));
      var sub = form.lead_count + (form.lead_count === 1 ? ' lead' : ' leads');
      title.appendChild(el('div', 'small muted', form.active ? sub : sub + ' · paused'));
      head.appendChild(title);

      var edit = el('button', 'btn-secondary btn-sm', 'Edit');
      edit.addEventListener('click', function () { openEditor(form); });
      head.appendChild(edit);

      var remove = el('button', 'btn-ghost btn-sm', 'Delete');
      remove.addEventListener('click', function () {
        if (!confirm('Delete "' + form.name + '" and its ' + form.lead_count + ' lead(s)? This cannot be undone.')) return;
        api('/api/forms/' + form.id, { method: 'DELETE' })
          .then(refreshForms)
          .then(loadStats)
          .then(function () { return loadLeads(false); })
          .catch(function (err) { showError(err.message); });
      });
      head.appendChild(remove);
      card.appendChild(head);

      card.appendChild(el('p', 'small muted', 'Paste this on your website, just before </body>:'));
      card.appendChild(el('pre', 'snippet', snippetFor(form)));

      var buttons = el('div', 'row');
      buttons.style.marginTop = '.6rem';
      buttons.appendChild(copyButton('Copy snippet', snippetFor(form)));

      var hosted = location.origin + '/f/' + form.key;
      buttons.appendChild(copyButton('Copy shareable link', hosted));
      var preview = el('a', 'btn btn-secondary btn-sm', 'Preview');
      preview.href = hosted;
      preview.target = '_blank';
      preview.rel = 'noopener';
      buttons.appendChild(preview);
      card.appendChild(buttons);

      list.appendChild(card);
    });
  }

  function refreshForms() {
    return api('/api/forms').then(function (data) {
      state.forms = data.forms;
      var filter = $('filter-form');
      var previous = filter.value;
      filter.textContent = '';
      var all = el('option', null, 'All forms');
      all.value = '';
      filter.appendChild(all);
      state.forms.forEach(function (form) {
        var option = el('option', null, form.name);
        option.value = String(form.id);
        filter.appendChild(option);
      });
      filter.value = previous;
      if (!$('view-forms').hidden) renderForms();
    });
  }

  /* --------------------------------------------------------- form editor  */

  var dialog = $('form-dialog');

  function renderFieldToggles(fields) {
    var container = $('field-toggles');
    container.textContent = '';
    [
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'message', label: 'Message' },
    ].forEach(function (item) {
      var spec = fields[item.key] || { show: true, required: false };
      var row = el('div', 'row');
      row.style.marginBottom = '.4rem';

      var showLabel = el('label', 'check');
      var show = el('input');
      show.type = 'checkbox';
      show.checked = spec.show !== false;
      show.dataset.field = item.key;
      show.dataset.role = 'show';
      showLabel.appendChild(show);
      showLabel.appendChild(document.createTextNode(item.label));
      row.appendChild(showLabel);

      var requiredLabel = el('label', 'check');
      var required = el('input');
      required.type = 'checkbox';
      required.checked = Boolean(spec.required);
      required.dataset.field = item.key;
      required.dataset.role = 'required';
      requiredLabel.appendChild(required);
      requiredLabel.appendChild(document.createTextNode('required'));
      row.appendChild(requiredLabel);

      var labelInput = el('input');
      labelInput.className = 'grow';
      labelInput.value = spec.label || '';
      labelInput.placeholder = 'Label shown to visitors';
      labelInput.dataset.field = item.key;
      labelInput.dataset.role = 'label';
      labelInput.style.maxWidth = '16rem';
      row.appendChild(labelInput);

      container.appendChild(row);
    });
  }

  function renderCustomFields() {
    var container = $('custom-fields');
    container.textContent = '';
    state.customFields.forEach(function (field, index) {
      var row = el('div', 'row');
      row.style.marginBottom = '.4rem';

      var label = el('input');
      label.className = 'grow';
      label.value = field.label || '';
      label.placeholder = 'e.g. Which service do you need?';
      label.addEventListener('input', function () { field.label = label.value; });
      row.appendChild(label);

      var type = el('select');
      type.style.width = 'auto';
      [['text', 'Text'], ['select', 'Dropdown']].forEach(function (pair) {
        var option = el('option', null, pair[1]);
        option.value = pair[0];
        if (field.type === pair[0]) option.selected = true;
        type.appendChild(option);
      });
      type.addEventListener('change', function () {
        field.type = type.value;
        renderCustomFields();
      });
      row.appendChild(type);

      var requiredLabel = el('label', 'check');
      var required = el('input');
      required.type = 'checkbox';
      required.checked = Boolean(field.required);
      required.addEventListener('change', function () { field.required = required.checked; });
      requiredLabel.appendChild(required);
      requiredLabel.appendChild(document.createTextNode('required'));
      row.appendChild(requiredLabel);

      var remove = el('button', 'btn-ghost btn-sm', 'Remove');
      remove.type = 'button';
      remove.addEventListener('click', function () {
        state.customFields.splice(index, 1);
        renderCustomFields();
      });
      row.appendChild(remove);
      container.appendChild(row);

      if (field.type === 'select') {
        var options = el('input');
        options.value = (field.options || []).join(', ');
        options.placeholder = 'Options, separated by commas';
        options.addEventListener('input', function () {
          field.options = options.value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
        });
        options.style.marginBottom = '.6rem';
        container.appendChild(options);
      }
    });
  }

  $('add-custom').addEventListener('click', function () {
    state.customFields.push({ label: '', type: 'text', required: false, options: [] });
    renderCustomFields();
  });

  function openEditor(form) {
    state.editing = form || null;
    var f = form || {
      name: '',
      headline: 'Get in touch',
      intro: '',
      button_text: 'Send',
      success_message: 'Thanks! We’ll be in touch shortly.',
      accent_color: '#2563eb',
      notify_email: '',
      active: true,
      fields: {
        name: { show: true, required: true, label: 'Your name' },
        email: { show: true, required: true, label: 'Email' },
        phone: { show: true, required: false, label: 'Phone' },
        message: { show: true, required: false, label: 'How can we help?' },
        custom: [],
      },
    };
    $('editor-title').textContent = form ? 'Edit form' : 'New form';
    $('f-name').value = f.name;
    $('f-headline').value = f.headline || '';
    $('f-intro').value = f.intro || '';
    $('f-button').value = f.button_text || '';
    $('f-color').value = f.accent_color || '#2563eb';
    $('f-success').value = f.success_message || '';
    $('f-notify').value = f.notify_email || '';
    $('f-active').checked = f.active !== false;
    renderFieldToggles(f.fields || {});
    state.customFields = ((f.fields || {}).custom || []).map(function (c) {
      return { label: c.label, type: c.type, required: c.required, options: (c.options || []).slice() };
    });
    renderCustomFields();
    $('editor-error').hidden = true;
    dialog.showModal();
  }

  $('new-form').addEventListener('click', function () { openEditor(null); });
  $('editor-cancel').addEventListener('click', function () { dialog.close(); });

  $('form-editor').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var fields = { custom: state.customFields.filter(function (c) { return c.label.trim(); }) };
    ['name', 'email', 'phone', 'message'].forEach(function (key) {
      fields[key] = {
        show: $('field-toggles').querySelector('[data-field="' + key + '"][data-role="show"]').checked,
        required: $('field-toggles').querySelector('[data-field="' + key + '"][data-role="required"]').checked,
        label: $('field-toggles').querySelector('[data-field="' + key + '"][data-role="label"]').value,
      };
    });

    var body = {
      name: $('f-name').value,
      headline: $('f-headline').value,
      intro: $('f-intro').value,
      button_text: $('f-button').value,
      success_message: $('f-success').value,
      accent_color: $('f-color').value,
      notify_email: $('f-notify').value,
      active: $('f-active').checked,
      fields: fields,
    };

    var editing = state.editing;
    var request = editing
      ? api('/api/forms/' + editing.id, { method: 'PUT', body: body })
      : api('/api/forms', { method: 'POST', body: body });

    var save = $('editor-save');
    save.disabled = true;
    request
      .then(function () {
        dialog.close();
        return refreshForms();
      })
      .catch(function (err) {
        $('editor-error').textContent = err.message;
        $('editor-error').hidden = false;
      })
      .finally(function () { save.disabled = false; });
  });

  /* -------------------------------------------------------------- settings */

  $('business-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    api('/api/account', { method: 'PATCH', body: { business_name: $('business-name').value } })
      .then(function () {
        $('business-saved').hidden = false;
        setTimeout(function () { $('business-saved').hidden = true; }, 2000);
      })
      .catch(function (err) { showError(err.message); });
  });

  $('password-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var msg = $('password-msg');
    api('/api/account/password', {
      method: 'POST',
      body: { current_password: $('current-password').value, new_password: $('new-password').value },
    })
      .then(function () {
        msg.textContent = 'Password changed. Other devices have been signed out.';
        msg.className = 'msg ok';
        msg.hidden = false;
        $('password-form').reset();
      })
      .catch(function (err) {
        msg.textContent = err.message;
        msg.className = 'msg error';
        msg.hidden = false;
      });
  });

  $('delete-account').addEventListener('click', function () {
    var password = window.prompt('This deletes every form and lead permanently. Type your password to confirm:');
    if (!password) return;
    fetch('/api/account', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password }),
    })
      .then(function (res) { return res.json().then(function (d) { return { ok: res.ok, data: d }; }); })
      .then(function (r) {
        if (!r.ok) throw new Error(r.data.error || 'Could not delete the account.');
        location.href = '/';
      })
      .catch(function (err) { showError(err.message); });
  });

  /* ----------------------------------------------------------------- boot  */

  api('/api/auth/me')
    .then(function (me) {
      $('account-email').textContent = me.email;
      $('business-name').value = me.business_name;
      if (!me.email_configured) {
        var status = $('email-status');
        status.className = 'msg error';
        status.textContent =
          'Email notifications are off: set RESEND_API_KEY on the server to have new leads emailed to you. ' +
          'Leads are still captured and listed here.';
        status.hidden = false;
      }
      return Promise.all([refreshForms(), loadLeads(false), loadStats()]);
    })
    .catch(function (err) {
      if (err.message !== 'Signed out.') showError(err.message);
    });
})();
