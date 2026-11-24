/*
 * Ray Bar booth sign editor (edit.html).
 * Every change saves to this device right away, and the preview picks it up
 * on its own. Publish puts the changes on the sign.
 */
(function () {
  'use strict';

  var B = window.Booth;
  var canSave = B.storageAvailable();
  var published = B.loadPublished(); // the last published lineup this device has seen
  var hadDraft = !!B.load();
  var menu = B.load() || (published ? published.menu : B.sampleMenu());
  var token = B.getToken();
  var publishing = false;
  var checkedSign = false;
  var uploading = {}; // product id -> true while its photo uploads

  var statusEl = document.getElementById('status');
  var sectionsEl = document.getElementById('sections');
  var dealsEl = document.getElementById('deals');
  var showsEl = document.getElementById('shows-list');
  var frame = document.getElementById('preview-frame');
  var stage = document.getElementById('preview-stage');
  var photoInput = document.getElementById('photo-input');

  /* ---------- Tiny DOM helper ---------- */

  function h(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (key) {
      var value = attrs[key];
      if (value === false || value === null || value === undefined) return;
      if (key === 'text') node.textContent = value;
      else if (key === 'value') node.value = value;
      else if (key === 'style') node.setAttribute('style', value);
      else node.setAttribute(key, value === true ? '' : value);
    });
    (children || []).forEach(function (child) {
      if (child) node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });
    return node;
  }

  /* ---------- Saving ---------- */

  var saveTimer = null;

  function setStatus(state, text) {
    statusEl.setAttribute('data-state', state);
    statusEl.textContent = text;
  }

  /* Shows whether this device's edits are on the sign yet. */
  function updateStatus() {
    if (!canSave) return setStatus('error', 'Not saved');
    if (publishing) return setStatus('busy', 'Publishing…');
    if (saveTimer) return setStatus('busy', 'Saving…');
    if (!checkedSign && !published) return setStatus('busy', 'Checking…');
    if (published && B.sameMenu(menu, published.menu)) return setStatus('ok', 'Published');
    return setStatus('pending', 'Not published');
  }

  function saveNow() {
    clearTimeout(saveTimer);
    saveTimer = null;
    if (canSave) B.save(menu);
    updateStatus();
    refreshPreview();
  }

  function saveSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 300);
    updateStatus();
  }

  function flush() {
    if (saveTimer) saveNow();
  }

  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flush();
  });

  if (!canSave) document.getElementById('storage-warning').hidden = false;

  /* ---------- Undo toast ---------- */

  var toast = document.getElementById('toast');
  var toastText = document.getElementById('toast-text');
  var toastUndo = document.getElementById('toast-undo');
  var toastTimer = null;
  var undoAction = null;

  function showToast(message, onUndo, long) {
    toastText.textContent = message;
    undoAction = onUndo || null;
    toastUndo.hidden = !onUndo;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, onUndo || long ? 9000 : 4000);
  }

  function hideToast() {
    toast.classList.remove('show');
    undoAction = null;
  }

  toastUndo.addEventListener('click', function () {
    if (undoAction) undoAction();
    hideToast();
  });

  /* Runs a change that can be undone from the toast. */
  function undoable(message, change) {
    flush();
    var before = JSON.stringify(menu);
    change();
    renderAll();
    saveNow();
    showToast(message, function () {
      menu = B.normalize(JSON.parse(before));
      renderAll();
      saveNow();
    });
  }

  /* ---------- Publishing ---------- */

  var publishBtn = document.getElementById('publish');
  var connectedEl = document.getElementById('connected');
  var notConnectedEl = document.getElementById('not-connected');
  var tokenInput = document.getElementById('token-input');
  var connectBtn = document.getElementById('connect');
  var connectError = document.getElementById('connect-error');
  var syncBanner = document.getElementById('sync-banner');

  if (B.CONFIG) {
    document.getElementById('repo-name').textContent = B.CONFIG.repo;
    // Pre-fills GitHub's new-key form where GitHub supports it; the steps on screen cover the rest.
    document.getElementById('make-key').href = 'https://github.com/settings/personal-access-tokens/new?' + [
      'name=' + encodeURIComponent('Ray Bar editor'),
      'description=' + encodeURIComponent('Lets the Ray Bar editors publish the menu and booth sign'),
      'target_name=' + encodeURIComponent(B.CONFIG.owner),
      'expires_in=366',
      'contents=write'
    ].join('&');
  } else {
    document.getElementById('publish-card').hidden = true;
    publishBtn.hidden = true;
  }

  function showConnection() {
    connectedEl.hidden = !token;
    notConnectedEl.hidden = !!token;
  }

  function showConnectError(message) {
    connectError.textContent = message || '';
    connectError.hidden = !message;
  }

  function forgetKey() {
    token = '';
    B.setToken('');
    showConnection();
  }

  function openConnect(message) {
    showConnectError(message);
    document.getElementById('publish-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(function () { tokenInput.focus({ preventScroll: true }); }, 450);
  }

  connectBtn.addEventListener('click', function () {
    var value = tokenInput.value.trim();
    if (!value) {
      showConnectError('Paste the key from GitHub first.');
      tokenInput.focus();
      return;
    }
    connectBtn.disabled = true;
    showConnectError('');
    B.checkToken(value).then(function () {
      token = value;
      B.setToken(token);
      tokenInput.value = '';
      showConnection();
      showToast('Connected. This device can publish to the sign now.');
    }).catch(function (err) {
      showConnectError(err && err.status === 401
        ? 'GitHub didn’t accept that key. Copy it again and paste the whole thing.'
        : 'Couldn’t reach GitHub. Check the internet connection and try again.');
    }).then(function () {
      connectBtn.disabled = false;
    });
  });

  tokenInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') connectBtn.click();
  });

  document.getElementById('disconnect').addEventListener('click', function () {
    forgetKey();
    showToast('Disconnected. This device can no longer publish.');
  });

  function githubErrorMessage(err, doing) {
    var status = err && err.status;
    if (status === 401) return 'GitHub didn’t accept this device’s key. It may have expired. Connect again with a new key.';
    if (status === 403 || status === 404) return 'That key can’t change the sign. Make a new key with access to ' + B.CONFIG.repo + ' and Contents set to Read and write.';
    if (status === 409 || status === 422) return 'The sign changed while ' + doing + '. Try again.';
    return 'Couldn’t reach GitHub. Check the internet connection and try again.';
  }

  /* Handles a GitHub failure; a bad key sends the person back to the connect steps. */
  function githubFailed(err, doing) {
    var status = err && err.status;
    if (status === 401 || status === 403 || status === 404) {
      forgetKey();
      openConnect(githubErrorMessage(err, doing));
    }
    showToast(githubErrorMessage(err, doing), null, true);
  }

  function publish() {
    flush();
    if (publishing) return;
    if (!token) {
      openConnect();
      showToast('Connect this device to GitHub first');
      return;
    }
    if (published && B.sameMenu(menu, published.menu)) {
      showToast('The sign already shows this');
      return;
    }

    publishing = true;
    publishBtn.disabled = true;
    updateStatus();
    var outgoing = B.normalize(JSON.parse(JSON.stringify(menu)));
    outgoing.updatedAt = new Date().toISOString();

    B.fetchPublished({ token: token }).then(function (current) {
      var currentSha = current.status === 'ok' ? current.sha : undefined;
      var changedElsewhere = current.status === 'ok' &&
        !B.sameMenu(current.menu, outgoing) &&
        (!published || current.sha !== published.sha);
      if (changedElsewhere && !window.confirm('The sign was changed from another device since this one last checked. Replace it with what\'s on this device?')) {
        return null;
      }
      return B.publishMenu(outgoing, token, currentSha);
    }).then(function (result) {
      if (!result) return;
      published = { sha: result.sha, etag: '', menu: outgoing };
      B.savePublished(published);
      syncBanner.hidden = true;
      showToast('Published. The sign updates within about 30 seconds.');
    }).catch(function (err) {
      githubFailed(err, 'publishing');
    }).then(function () {
      publishing = false;
      publishBtn.disabled = false;
      updateStatus();
    });
  }

  publishBtn.addEventListener('click', publish);

  /* On opening, load what's on the sign unless this device has unpublished edits. */
  function checkSign() {
    if (!B.CONFIG) {
      checkedSign = true;
      updateStatus();
      return;
    }
    B.fetchPublished({ token: token }).then(function (result) {
      checkedSign = true;
      if (result.status !== 'ok') return;
      var before = published;
      published = { sha: result.sha, etag: '', menu: result.menu };
      B.savePublished(published);
      if (B.sameMenu(menu, result.menu)) return;
      var untouched = !hadDraft || (before && B.sameMenu(menu, before.menu));
      if (untouched) {
        menu = B.normalize(result.menu);
        if (canSave) B.save(menu);
        renderAll();
        refreshPreview();
      } else {
        syncBanner.hidden = false;
        window.scrollTo(0, 0);
      }
    }).catch(function () {
      checkedSign = true; // offline: keep working on the draft
    }).then(updateStatus);
  }

  document.getElementById('use-sign').addEventListener('click', function () {
    syncBanner.hidden = true;
    if (!published) return;
    undoable('Loaded what\'s on the sign', function () {
      menu = B.normalize(published.menu);
    });
  });

  document.getElementById('keep-draft').addEventListener('click', function () {
    syncBanner.hidden = true;
  });

  // The sign on this same device saw a newer published lineup.
  window.addEventListener('storage', function (e) {
    if (e.key === B.PUBLISHED_KEY) {
      published = B.loadPublished();
      updateStatus();
    }
  });

  /* ---------- Preview ---------- */

  var screen = 'landscape';
  var PREVIEW_SIZES = { landscape: [1180, 820], portrait: [820, 1180], tv: [1920, 1080] };

  function sizePreview() {
    var dims = PREVIEW_SIZES[screen];
    var available = stage.clientWidth;
    if (!available) return;
    var scale = available / dims[0];
    if (screen === 'portrait') scale = Math.min(scale, (window.innerHeight * 0.62) / dims[1]);
    frame.style.width = dims[0] + 'px';
    frame.style.height = dims[1] + 'px';
    frame.style.transform = 'scale(' + scale + ')';
    frame.style.left = Math.max(0, (available - dims[0] * scale) / 2) + 'px';
    stage.style.height = Math.round(dims[1] * scale) + 'px';
  }

  function refreshPreview() {
    try {
      if (frame.contentWindow && frame.contentWindow.BoothSign) frame.contentWindow.BoothSign.reload();
    } catch (e) { /* the preview will catch up on its own */ }
  }

  document.querySelectorAll('input[name="screen"]').forEach(function (input) {
    input.addEventListener('change', function () {
      screen = input.value;
      sizePreview();
    });
  });
  if (window.ResizeObserver) new ResizeObserver(sizePreview).observe(stage);
  window.addEventListener('resize', sizePreview);
  sizePreview();

  /* ---------- Simple fields, switches and choices ---------- */

  function getPath(path) {
    return path.split('.').reduce(function (obj, key) { return obj[key]; }, menu);
  }

  function setPath(path, value) {
    var keys = path.split('.');
    var last = keys.pop();
    keys.reduce(function (obj, key) { return obj[key]; }, menu)[last] = value;
  }

  function buildChoices(containerId, name, choices) {
    var box = document.getElementById(containerId);
    box.textContent = '';
    choices.forEach(function (choice) {
      box.appendChild(h('label', {}, [
        h('input', { type: 'radio', name: name, value: choice.id }),
        h('span', { text: choice.name })
      ]));
    });
  }

  buildChoices('theme-choices', 'theme', B.THEMES);
  buildChoices('layout-choices', 'layout', B.LAYOUTS);
  buildChoices('column-choices', 'columns', B.COLUMN_CHOICES.map(function (c) {
    return { id: c, name: c === 'auto' ? 'Auto' : c };
  }));

  var CHOICE_NAMES = ['theme', 'layout', 'columns', 'soldOut'];

  function populateStatic() {
    document.querySelectorAll('[data-bind]').forEach(function (input) {
      var value = getPath(input.getAttribute('data-bind'));
      if (input.type === 'checkbox') input.checked = !!value;
      else input.value = value;
    });
    CHOICE_NAMES.forEach(function (name) {
      document.querySelectorAll('input[name="' + name + '"]').forEach(function (radio) {
        radio.checked = radio.value === String(menu.settings[name]);
      });
    });
  }

  document.querySelectorAll('[data-bind]').forEach(function (input) {
    var path = input.getAttribute('data-bind');
    input.addEventListener(input.type === 'checkbox' ? 'change' : 'input', function () {
      setPath(path, input.type === 'checkbox' ? input.checked : input.value);
      if (input.type === 'checkbox') saveNow(); else saveSoon();
    });
  });

  CHOICE_NAMES.forEach(function (name) {
    document.querySelectorAll('input[name="' + name + '"]').forEach(function (radio) {
      radio.addEventListener('change', function () {
        if (!radio.checked) return;
        menu.settings[name] = radio.value;
        saveNow();
      });
    });
  });

  /* ---------- Payment methods ---------- */

  var payEl = document.getElementById('pay-methods');

  function renderPayments() {
    payEl.textContent = '';
    B.PAYMENT_METHODS.forEach(function (method) {
      var on = menu.payments.methods.indexOf(method) >= 0;
      payEl.appendChild(h('button', {
        type: 'button',
        class: 'chip',
        'data-method': method,
        'aria-pressed': String(on),
        text: (on ? '✓ ' : '') + method
      }));
    });
  }

  payEl.addEventListener('click', function (e) {
    var button = e.target.closest('[data-method]');
    if (!button) return;
    var method = button.getAttribute('data-method');
    var list = menu.payments.methods;
    var at = list.indexOf(method);
    if (at >= 0) list.splice(at, 1); else list.push(method);
    menu.payments.methods = B.PAYMENT_METHODS.filter(function (m) { return list.indexOf(m) >= 0; });
    saveNow();
    renderPayments();
    var again = payEl.querySelector('[data-method="' + method + '"]');
    if (again) again.focus();
  });

  /* ---------- Show specials ---------- */

  function renderDeals(focusId) {
    dealsEl.textContent = '';
    menu.deals.forEach(function (deal, i) {
      dealsEl.appendChild(h('div', { class: 'deal-row' + (deal.visible ? '' : ' is-hidden'), 'data-deal': deal.id }, [
        h('input', { type: 'text', class: 'deal-input', value: deal.text, maxlength: '60', placeholder: 'Any 3 bitters for $55', 'aria-label': 'Special ' + (i + 1), autocomplete: 'off' }),
        h('button', { type: 'button', class: 'chip', 'data-action': 'toggle-deal', 'aria-pressed': String(deal.visible), text: deal.visible ? 'Shown' : 'Hidden' }),
        iconButton('Delete special', 'delete-deal', '✕', false, 'delete')
      ]));
    });
    if (focusId) {
      var target = dealsEl.querySelector('[data-deal="' + focusId + '"] .deal-input');
      if (target) target.focus();
    }
  }

  function findDeal(id) {
    for (var i = 0; i < menu.deals.length; i++) {
      if (menu.deals[i].id === id) return { deal: menu.deals[i], index: i };
    }
    return null;
  }

  dealsEl.addEventListener('input', function (e) {
    var row = e.target.closest('[data-deal]');
    var found = row && findDeal(row.getAttribute('data-deal'));
    if (!found) return;
    found.deal.text = e.target.value;
    saveSoon();
  });

  /* ---------- Saved shows ---------- */

  var showNameInput = document.getElementById('show-name');

  function formatDate(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function renderShows() {
    showsEl.textContent = '';
    if (!menu.shows.length) {
      showsEl.appendChild(h('p', { class: 'empty-note', text: 'No saved shows yet.' }));
      return;
    }
    menu.shows.forEach(function (show) {
      var count = show.data.sections.reduce(function (n, s) { return n + s.items.length; }, 0);
      showsEl.appendChild(h('div', { class: 'show-row', 'data-show': show.id }, [
        h('div', { class: 'show-info' }, [
          h('strong', { text: show.name || 'Untitled show' }),
          h('span', { text: [formatDate(show.savedAt), count + (count === 1 ? ' product' : ' products')].filter(Boolean).join(' · ') })
        ]),
        h('div', { class: 'show-tools' }, [
          h('button', { type: 'button', class: 'btn small-btn primary', 'data-action': 'load-show', text: 'Load' }),
          h('button', { type: 'button', class: 'btn small-btn', 'data-action': 'update-show', title: 'Replace this saved show with what you have now', text: 'Update' }),
          iconButton('Delete saved show', 'delete-show', '✕', false, 'delete')
        ])
      ]));
    });
  }

  function findShow(id) {
    for (var i = 0; i < menu.shows.length; i++) {
      if (menu.shows[i].id === id) return { show: menu.shows[i], index: i };
    }
    return null;
  }

  function saveShow() {
    flush();
    var name = showNameInput.value.trim() || menu.show.title.trim() || 'Show';
    var existing = null;
    menu.shows.forEach(function (s) {
      if (s.name.trim().toLowerCase() === name.toLowerCase()) existing = s;
    });
    undoable(existing ? 'Updated the saved show ' + name : 'Saved ' + name, function () {
      var entry = { id: existing ? existing.id : B.uid(), name: name, savedAt: new Date().toISOString(), data: B.snapshot(menu) };
      if (existing) {
        menu.shows[findShow(existing.id).index] = entry;
      } else {
        menu.shows.unshift(entry);
      }
    });
    showNameInput.value = '';
  }

  document.getElementById('save-show').addEventListener('click', saveShow);
  showNameInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') saveShow();
  });

  /* ---------- Products ---------- */

  function findSection(id) {
    for (var i = 0; i < menu.sections.length; i++) {
      if (menu.sections[i].id === id) return { section: menu.sections[i], index: i };
    }
    return null;
  }

  function findItem(section, id) {
    for (var i = 0; i < section.items.length; i++) {
      if (section.items[i].id === id) return { item: section.items[i], index: i };
    }
    return null;
  }

  /* Finds a product anywhere in the lineup. */
  function findProduct(id) {
    for (var i = 0; i < menu.sections.length; i++) {
      var hit = findItem(menu.sections[i], id);
      if (hit) return hit;
    }
    return null;
  }

  function move(list, index, delta) {
    var to = index + delta;
    if (to < 0 || to >= list.length) return false;
    var moved = list.splice(index, 1)[0];
    list.splice(to, 0, moved);
    return true;
  }

  function iconButton(label, action, symbol, disabled, extraClass) {
    return h('button', {
      type: 'button',
      class: 'icon-btn' + (extraClass ? ' ' + extraClass : ''),
      'data-action': action,
      'aria-label': label,
      title: label,
      disabled: !!disabled,
      text: symbol
    });
  }

  function mini(label, input) {
    return h('label', { class: 'mini ' + input.className.replace('-input', '') }, [h('span', { text: label }), input]);
  }

  function photoButton(item) {
    var busy = !!uploading[item.id];
    var src = B.safeUrl(item.photo);
    var button = h('button', {
      type: 'button',
      class: 'photo-btn' + (src ? '' : ' empty') + (busy ? ' busy' : ''),
      'data-action': 'pick-photo',
      'aria-label': src ? 'Change photo of ' + (item.name || 'this product') : 'Add a photo of ' + (item.name || 'this product'),
      disabled: busy
    }, [
      src ? h('img', { src: src, alt: '' }) : null,
      h('span', { class: 'photo-label', text: busy ? 'Uploading…' : (src ? 'Change' : '+ Photo') })
    ]);
    return h('div', { class: 'photo-cell' }, [
      button,
      src && !busy ? h('button', { type: 'button', class: 'photo-remove', 'data-action': 'remove-photo', 'aria-label': 'Remove photo', title: 'Remove photo', text: '✕' }) : null
    ]);
  }

  function itemRow(item, index, count) {
    var priceInput = h('input', { type: 'text', class: 'price-input', 'data-field': 'price', value: item.price, placeholder: '20', 'aria-label': 'Price', autocomplete: 'off', inputmode: 'decimal' });
    var saleInput = h('input', { type: 'text', class: 'sale-input', 'data-field': 'salePrice', value: item.salePrice, placeholder: 'none', 'aria-label': 'Sale price (optional)', autocomplete: 'off', inputmode: 'decimal' });
    var sizeInput = h('input', { type: 'text', class: 'size-input', 'data-field': 'size', value: item.size, placeholder: '2 oz', 'aria-label': 'Size', autocomplete: 'off' });
    var badgeInput = h('input', { type: 'text', class: 'badge-input', 'data-field': 'badge', value: item.badge, placeholder: 'New, Best seller…', 'aria-label': 'Label', autocomplete: 'off', list: 'badge-ideas', maxlength: '20' });

    return h('div', { class: 'item-row' + (item.available ? '' : ' is-out'), 'data-item': item.id }, [
      photoButton(item),
      h('input', { type: 'text', class: 'name-input', 'data-field': 'name', value: item.name, placeholder: 'Product name', 'aria-label': 'Product name', autocomplete: 'off' }),
      mini('Price', priceInput),
      mini('Sale', saleInput),
      h('input', { type: 'text', class: 'desc-input', 'data-field': 'description', value: item.description, placeholder: 'Short description (optional)', 'aria-label': 'Description', autocomplete: 'off', maxlength: '90' }),
      mini('Size', sizeInput),
      mini('Label', badgeInput),
      h('div', { class: 'tools' }, [
        h('button', { type: 'button', class: 'chip stock', 'data-action': 'toggle-available', 'aria-pressed': String(item.available), text: item.available ? 'In stock' : 'Sold out' }),
        iconButton('Move product up', 'item-up', '↑', index === 0),
        iconButton('Move product down', 'item-down', '↓', index === count - 1),
        iconButton('Delete product', 'item-delete', '✕', false, 'delete')
      ])
    ]);
  }

  function sectionCard(section, index, count) {
    var items = h('div', { class: 'items' }, section.items.map(function (item, i) {
      return itemRow(item, i, section.items.length);
    }));

    return h('article', {
      class: 'card section' + (section.visible ? '' : ' is-hidden'),
      'data-sec': section.id
    }, [
      h('div', { class: 'section-head' }, [
        h('input', { type: 'text', class: 'title-input', 'data-field': 'title', value: section.title, placeholder: 'Category, like Bitters', 'aria-label': 'Category name', autocomplete: 'off' }),
        h('div', { class: 'section-tools' }, [
          h('button', { type: 'button', class: 'chip', 'data-action': 'toggle-section', 'aria-pressed': String(section.visible), text: section.visible ? 'Shown' : 'Hidden' }),
          iconButton('Move category up', 'sec-up', '↑', index === 0),
          iconButton('Move category down', 'sec-down', '↓', index === count - 1),
          iconButton('Delete category', 'sec-delete', '✕', false, 'delete')
        ])
      ]),
      h('input', { type: 'text', class: 'note-input', 'data-field': 'note', value: section.note, placeholder: 'Short note under the category (price list layout only)', 'aria-label': 'Note under the category', autocomplete: 'off' }),
      items,
      h('button', { type: 'button', class: 'btn add-item', 'data-action': 'add-item', text: '+ Add product' })
    ]);
  }

  /* Redraws the products. `focusSelector` keeps focus on a control; `reveal` also scrolls to it. */
  function renderSections(focusSelector, reveal) {
    sectionsEl.textContent = '';
    if (!menu.sections.length) {
      sectionsEl.appendChild(h('p', { class: 'empty', text: 'No categories yet. Add one below.' }));
    }
    menu.sections.forEach(function (section, i) {
      sectionsEl.appendChild(sectionCard(section, i, menu.sections.length));
    });
    if (focusSelector) {
      var target = sectionsEl.querySelector(focusSelector);
      if (target) {
        target.focus({ preventScroll: true });
        if (reveal) target.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }
  }

  function renderAll() {
    populateStatic();
    renderPayments();
    renderDeals();
    renderSections();
    renderShows();
  }

  /* Typing in any field inside a category */
  sectionsEl.addEventListener('input', function (e) {
    var field = e.target.getAttribute('data-field');
    if (!field) return;
    var card = e.target.closest('[data-sec]');
    var found = card && findSection(card.getAttribute('data-sec'));
    if (!found) return;
    var row = e.target.closest('[data-item]');
    if (row) {
      var hit = findItem(found.section, row.getAttribute('data-item'));
      if (hit) hit.item[field] = e.target.value;
    } else {
      found.section[field] = e.target.value;
    }
    saveSoon();
  });

  /* ---------- Photos ---------- */

  var photoTarget = null; // product id waiting for a picked photo

  /* Shrinks a picked photo to a sensible size and turns it into a JPEG. */
  function preparePhoto(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var max = 900;
        var scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        var w = Math.max(1, Math.round(img.naturalWidth * scale));
        var hgt = Math.max(1, Math.round(img.naturalHeight * scale));
        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = hgt;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, hgt);
        ctx.drawImage(img, 0, 0, w, hgt);
        URL.revokeObjectURL(url);
        canvas.toBlob(function (blob) {
          if (blob) resolve(blob); else reject(new Error('Could not read that photo'));
        }, 'image/jpeg', 0.84);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('Could not read that photo'));
      };
      img.src = url;
    });
  }

  photoInput.addEventListener('change', function () {
    var file = photoInput.files && photoInput.files[0];
    var id = photoTarget;
    photoInput.value = '';
    photoTarget = null;
    if (!file || !id) return;

    uploading[id] = true;
    renderSections();
    preparePhoto(file).then(function (blob) {
      return B.uploadPhoto(blob, token);
    }).then(function (url) {
      delete uploading[id];
      var hit = findProduct(id);
      if (hit) {
        hit.item.photo = url;
        saveNow();
        showToast('Photo added. Tap Publish to put it on the sign.');
      }
      renderSections();
    }).catch(function (err) {
      delete uploading[id];
      renderSections();
      if (err && err.status) githubFailed(err, 'adding the photo');
      else showToast('That photo couldn’t be used. Try a different one.', null, true);
    });
  });

  /* ---------- Buttons ---------- */

  function newItem() {
    return { id: B.uid(), name: '', size: '', description: '', price: '', salePrice: '', badge: '', photo: '', available: true };
  }

  document.addEventListener('click', function (e) {
    var button = e.target.closest('[data-action]');
    if (!button) return;
    var action = button.getAttribute('data-action');

    if (action === 'add-section') {
      flush();
      var section = { id: B.uid(), title: '', note: '', visible: true, items: [newItem()] };
      menu.sections.push(section);
      saveNow();
      renderSections('[data-sec="' + section.id + '"] .title-input', true);
      return;
    }

    if (action === 'add-deal') {
      flush();
      var deal = { id: B.uid(), text: '', visible: true };
      menu.deals.push(deal);
      saveNow();
      renderDeals(deal.id);
      return;
    }

    var dealRow = button.closest('[data-deal]');
    if (dealRow) {
      var foundDeal = findDeal(dealRow.getAttribute('data-deal'));
      if (!foundDeal) return;
      if (action === 'toggle-deal') {
        foundDeal.deal.visible = !foundDeal.deal.visible;
        saveNow();
        renderDeals();
        var again = dealsEl.querySelector('[data-deal="' + foundDeal.deal.id + '"] [data-action="toggle-deal"]');
        if (again) again.focus();
      } else if (action === 'delete-deal') {
        undoable('Deleted a special', function () {
          menu.deals.splice(foundDeal.index, 1);
        });
      }
      return;
    }

    var showRow = button.closest('[data-show]');
    if (showRow) {
      var foundShow = findShow(showRow.getAttribute('data-show'));
      if (!foundShow) return;
      var saved = foundShow.show;
      if (action === 'load-show') {
        undoable('Loaded ' + (saved.name || 'the saved show') + '. Tap Publish to put it on the sign.', function () {
          menu = B.applySnapshot(menu, saved.data);
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (action === 'update-show') {
        undoable('Updated ' + (saved.name || 'the saved show') + ' with what you have now', function () {
          saved.data = B.snapshot(menu);
          saved.savedAt = new Date().toISOString();
        });
      } else if (action === 'delete-show') {
        undoable('Deleted the saved show ' + (saved.name || ''), function () {
          menu.shows.splice(foundShow.index, 1);
        });
      }
      return;
    }

    var card = button.closest('[data-sec]');
    var found = card && findSection(card.getAttribute('data-sec'));
    if (!found) return;
    var sec = found.section;
    var row = button.closest('[data-item]');
    var hit = row ? findItem(sec, row.getAttribute('data-item')) : null;

    switch (action) {
      case 'add-item': {
        flush();
        var item = newItem();
        sec.items.push(item);
        saveNow();
        renderSections('[data-item="' + item.id + '"] .name-input', true);
        break;
      }
      case 'toggle-section':
        sec.visible = !sec.visible;
        saveNow();
        renderSections('[data-sec="' + sec.id + '"] [data-action="toggle-section"]');
        break;
      case 'sec-up':
      case 'sec-down':
        flush();
        if (move(menu.sections, found.index, action === 'sec-up' ? -1 : 1)) {
          saveNow();
          renderSections('[data-sec="' + sec.id + '"] [data-action="' + action + '"]:not(:disabled)', true);
        }
        break;
      case 'sec-delete':
        undoable('Deleted the ' + (sec.title.trim() || 'untitled') + ' category', function () {
          menu.sections.splice(found.index, 1);
        });
        break;
      case 'toggle-available':
        if (!hit) break;
        hit.item.available = !hit.item.available;
        saveNow();
        renderSections('[data-item="' + hit.item.id + '"] [data-action="toggle-available"]');
        break;
      case 'item-up':
      case 'item-down':
        if (!hit) break;
        flush();
        if (move(sec.items, hit.index, action === 'item-up' ? -1 : 1)) {
          saveNow();
          renderSections('[data-item="' + hit.item.id + '"] [data-action="' + action + '"]:not(:disabled)', true);
        }
        break;
      case 'item-delete':
        if (!hit) break;
        undoable('Deleted ' + (hit.item.name.trim() || 'a product'), function () {
          sec.items.splice(hit.index, 1);
        });
        break;
      case 'pick-photo':
        if (!hit) break;
        if (!token) {
          openConnect();
          showToast('Connect this device to GitHub to add photos');
          break;
        }
        photoTarget = hit.item.id;
        photoInput.click();
        break;
      case 'remove-photo':
        if (!hit) break;
        undoable('Removed the photo of ' + (hit.item.name.trim() || 'a product'), function () {
          hit.item.photo = '';
        });
        break;
    }
  });

  /* ---------- Backup ---------- */

  document.getElementById('export').addEventListener('click', function () {
    flush();
    var stamp = new Date().toISOString().slice(0, 10);
    var blob = new Blob([JSON.stringify(menu, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var link = h('a', { href: url, download: 'ray-bar-booth-' + stamp + '.json' });
    document.body.appendChild(link);
    link.click();
    setTimeout(function () {
      URL.revokeObjectURL(url);
      link.remove();
    }, 1000);
  });

  document.getElementById('import').addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var data;
      try {
        data = JSON.parse(reader.result);
      } catch (err) {
        showToast('That file is not a Ray Bar booth file');
        return;
      }
      if (!data || !Array.isArray(data.sections) || !data.brand) {
        showToast('That file is not a Ray Bar booth file');
        return;
      }
      undoable('File imported', function () {
        menu = B.normalize(data);
      });
    };
    reader.readAsText(file);
  });

  document.getElementById('reset').addEventListener('click', function () {
    undoable('Started over from the website lineup. Saved shows were kept.', function () {
      var fresh = B.sampleMenu();
      fresh.shows = menu.shows;
      menu = fresh;
    });
  });

  /* ---------- Start ---------- */

  var ideas = document.getElementById('badge-ideas');
  B.BADGES.forEach(function (b) { ideas.appendChild(h('option', { value: b })); });

  showConnection();
  renderAll();
  if (canSave && !B.readRaw()) B.save(menu);
  updateStatus();
  checkSign();

  if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.register('sw.js').catch(function () { /* online-only is fine */ });
  }
})();
