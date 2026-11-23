/*
 * Ray Bar editor (edit.html).
 * Every change saves to this device right away, and the preview and the
 * sign pick it up on their own.
 */
(function () {
  'use strict';

  var RB = window.RayBar;
  var canSave = RB.storageAvailable();
  var menu = RB.load() || RB.sampleMenu();

  var statusEl = document.getElementById('status');
  var sectionsEl = document.getElementById('sections');
  var frame = document.getElementById('preview-frame');
  var stage = document.getElementById('preview-stage');

  var SWATCHES = {
    rust: '#8a4823',
    wood: '#7a5433',
    enamel: '#a3272b',
    caution: '#e3b32a',
    cardboard: '#c49a6c',
    chalk: '#4d6b57',
    diner: '#3b8f84'
  };

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

  function setStatus(state) {
    statusEl.setAttribute('data-state', state);
    statusEl.textContent = state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : 'Not saved';
  }

  function saveNow() {
    clearTimeout(saveTimer);
    saveTimer = null;
    var ok = canSave && RB.save(menu);
    setStatus(ok ? 'saved' : 'error');
    refreshPreview();
  }

  function saveSoon() {
    setStatus('saving');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 300);
  }

  function flush() {
    if (saveTimer) saveNow();
  }

  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flush();
  });

  if (!canSave) {
    document.getElementById('storage-warning').hidden = false;
    setStatus('error');
  }

  /* ---------- Undo toast ---------- */

  var toast = document.getElementById('toast');
  var toastText = document.getElementById('toast-text');
  var toastUndo = document.getElementById('toast-undo');
  var toastTimer = null;
  var undoAction = null;

  function showToast(message, onUndo) {
    toastText.textContent = message;
    undoAction = onUndo || null;
    toastUndo.hidden = !onUndo;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, onUndo ? 8000 : 4000);
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
      menu = RB.normalize(JSON.parse(before));
      renderAll();
      saveNow();
    });
  }

  /* ---------- Preview ---------- */

  var orientation = 'landscape';
  var PREVIEW_SIZES = { landscape: [1180, 820], portrait: [820, 1180] };

  function sizePreview() {
    var dims = PREVIEW_SIZES[orientation];
    var available = stage.clientWidth;
    if (!available) return;
    var scale = available / dims[0];
    if (orientation === 'portrait') scale = Math.min(scale, (window.innerHeight * 0.62) / dims[1]);
    frame.style.width = dims[0] + 'px';
    frame.style.height = dims[1] + 'px';
    frame.style.transform = 'scale(' + scale + ')';
    frame.style.left = Math.max(0, (available - dims[0] * scale) / 2) + 'px';
    stage.style.height = Math.round(dims[1] * scale) + 'px';
  }

  function refreshPreview() {
    try {
      if (frame.contentWindow && frame.contentWindow.RayBarSign) frame.contentWindow.RayBarSign.reload();
    } catch (e) { /* the preview will catch up on its own */ }
  }

  document.querySelectorAll('input[name="orientation"]').forEach(function (input) {
    input.addEventListener('change', function () {
      orientation = input.value;
      sizePreview();
    });
  });
  if (window.ResizeObserver) new ResizeObserver(sizePreview).observe(stage);
  window.addEventListener('resize', sizePreview);
  sizePreview();

  /* ---------- Sign details and look ---------- */

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

  buildChoices('wall-choices', 'wall', RB.WALLS);
  buildChoices('column-choices', 'columns', RB.COLUMN_CHOICES.map(function (c) {
    return { id: c, name: c === 'auto' ? 'Auto' : c };
  }));

  function populateStatic() {
    document.querySelectorAll('[data-bind]').forEach(function (input) {
      var value = getPath(input.getAttribute('data-bind'));
      if (input.type === 'checkbox') input.checked = !!value;
      else input.value = value;
    });
    ['wall', 'columns', 'soldOut'].forEach(function (name) {
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

  ['wall', 'columns', 'soldOut'].forEach(function (name) {
    document.querySelectorAll('input[name="' + name + '"]').forEach(function (radio) {
      radio.addEventListener('change', function () {
        if (!radio.checked) return;
        menu.settings[name] = radio.value;
        saveNow();
      });
    });
  });

  /* ---------- Signs (sections) and drinks ---------- */

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

  function styleSelect(section, index) {
    var autoName = RB.SIGN_STYLES[index % RB.SIGN_STYLES.length].name;
    var select = h('select', { 'data-field': 'style', 'aria-label': 'Sign style' }, [
      h('option', { value: 'auto', text: 'Auto (' + autoName + ')' })
    ].concat(RB.SIGN_STYLES.map(function (s) {
      return h('option', { value: s.id, text: s.name });
    })));
    select.value = section.style;
    return select;
  }

  function itemRow(item, index, count) {
    var row = h('div', { class: 'item-row' + (item.available ? '' : ' is-out'), 'data-item': item.id }, [
      h('div', { class: 'move' }, [
        iconButton('Move drink up', 'item-up', '↑', index === 0),
        iconButton('Move drink down', 'item-down', '↓', index === count - 1)
      ]),
      h('input', { type: 'text', class: 'name-input', 'data-field': 'name', value: item.name, placeholder: 'Drink name', 'aria-label': 'Drink name', autocomplete: 'off' }),
      h('input', { type: 'text', class: 'price-input', 'data-field': 'price', value: item.price, placeholder: 'Price', 'aria-label': 'Price', autocomplete: 'off', inputmode: 'decimal' }),
      h('div', { class: 'tools' }, [
        h('button', { type: 'button', class: 'chip stock', 'data-action': 'toggle-available', 'aria-pressed': String(item.available), text: item.available ? 'In stock' : 'Out' }),
        h('button', { type: 'button', class: 'chip', 'data-action': 'toggle-featured', 'aria-pressed': String(item.featured), title: 'Mark as a house special', text: '★ Special' }),
        iconButton('Delete drink', 'item-delete', '✕', false, 'delete')
      ]),
      h('input', { type: 'text', class: 'desc-input', 'data-field': 'description', value: item.description, placeholder: 'Description or ingredients (optional)', 'aria-label': 'Description', autocomplete: 'off' })
    ]);
    return row;
  }

  function sectionCard(section, index, count) {
    var resolved = RB.resolveStyle(section, index);
    var items = h('div', { class: 'items' }, section.items.map(function (item, i) {
      return itemRow(item, i, section.items.length);
    }));

    return h('article', {
      class: 'card section' + (section.visible ? '' : ' is-hidden'),
      'data-sec': section.id,
      style: '--swatch:' + SWATCHES[resolved]
    }, [
      h('div', { class: 'section-head' }, [
        h('input', { type: 'text', class: 'title-input', 'data-field': 'title', value: section.title, placeholder: 'Sign title', 'aria-label': 'Sign title', autocomplete: 'off' }),
        styleSelect(section, index),
        h('div', { class: 'section-tools' }, [
          h('button', { type: 'button', class: 'chip', 'data-action': 'toggle-section', 'aria-pressed': String(section.visible), text: section.visible ? 'Shown' : 'Hidden' }),
          iconButton('Move sign up', 'sec-up', '↑', index === 0),
          iconButton('Move sign down', 'sec-down', '↓', index === count - 1),
          iconButton('Delete sign', 'sec-delete', '✕', false, 'delete')
        ])
      ]),
      h('input', { type: 'text', class: 'note-input', 'data-field': 'note', value: section.note, placeholder: 'Small note under the title (optional)', 'aria-label': 'Note under the title', autocomplete: 'off' }),
      items,
      h('button', { type: 'button', class: 'btn add-item', 'data-action': 'add-item', text: '+ Add drink' })
    ]);
  }

  function renderSections(focusSelector) {
    sectionsEl.textContent = '';
    if (!menu.sections.length) {
      sectionsEl.appendChild(h('p', { class: 'empty', text: 'No signs yet. Add one below.' }));
    }
    menu.sections.forEach(function (section, i) {
      sectionsEl.appendChild(sectionCard(section, i, menu.sections.length));
    });
    if (focusSelector) {
      var target = sectionsEl.querySelector(focusSelector);
      if (target) {
        target.focus({ preventScroll: true });
        target.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }
  }

  function renderAll() {
    populateStatic();
    renderSections();
  }

  /* Typing in any field inside a sign */
  sectionsEl.addEventListener('input', function (e) {
    var field = e.target.getAttribute('data-field');
    if (!field || field === 'style') return;
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

  /* Changing a sign's style */
  sectionsEl.addEventListener('change', function (e) {
    if (e.target.getAttribute('data-field') !== 'style') return;
    var card = e.target.closest('[data-sec]');
    var found = card && findSection(card.getAttribute('data-sec'));
    if (!found) return;
    found.section.style = e.target.value;
    card.style.setProperty('--swatch', SWATCHES[RB.resolveStyle(found.section, found.index)]);
    saveNow();
  });

  /* Buttons */
  document.addEventListener('click', function (e) {
    var button = e.target.closest('[data-action]');
    if (!button) return;
    var action = button.getAttribute('data-action');

    if (action === 'add-section') {
      flush();
      var section = { id: RB.uid(), title: '', note: '', style: 'auto', visible: true, items: [] };
      section.items.push(newItem());
      menu.sections.push(section);
      saveNow();
      renderSections('[data-sec="' + section.id + '"] .title-input');
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
        renderSections('[data-item="' + item.id + '"] .name-input');
        break;
      }
      case 'toggle-section':
        sec.visible = !sec.visible;
        saveNow();
        renderSections();
        break;
      case 'sec-up':
      case 'sec-down':
        flush();
        if (move(menu.sections, found.index, action === 'sec-up' ? -1 : 1)) {
          saveNow();
          renderSections('[data-sec="' + sec.id + '"] [data-action="' + action + '"]:not(:disabled)');
        }
        break;
      case 'sec-delete':
        undoable('Deleted the ' + (sec.title.trim() || 'untitled') + ' sign', function () {
          menu.sections.splice(found.index, 1);
        });
        break;
      case 'toggle-available':
        if (!hit) break;
        hit.item.available = !hit.item.available;
        saveNow();
        renderSections('[data-item="' + hit.item.id + '"] [data-action="toggle-available"]');
        break;
      case 'toggle-featured':
        if (!hit) break;
        hit.item.featured = !hit.item.featured;
        saveNow();
        renderSections('[data-item="' + hit.item.id + '"] [data-action="toggle-featured"]');
        break;
      case 'item-up':
      case 'item-down':
        if (!hit) break;
        flush();
        if (move(sec.items, hit.index, action === 'item-up' ? -1 : 1)) {
          saveNow();
          renderSections('[data-item="' + hit.item.id + '"] [data-action="' + action + '"]:not(:disabled)');
        }
        break;
      case 'item-delete':
        if (!hit) break;
        undoable('Deleted ' + (hit.item.name.trim() || 'a drink'), function () {
          sec.items.splice(hit.index, 1);
        });
        break;
    }
  });

  function newItem() {
    return { id: RB.uid(), name: '', description: '', price: '', available: true, featured: false };
  }

  /* ---------- Backup ---------- */

  document.getElementById('export').addEventListener('click', function () {
    flush();
    var stamp = new Date().toISOString().slice(0, 10);
    var blob = new Blob([JSON.stringify(menu, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var link = h('a', { href: url, download: 'ray-bar-menu-' + stamp + '.json' });
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
        showToast('That file is not a Ray Bar menu');
        return;
      }
      if (!data || !Array.isArray(data.sections)) {
        showToast('That file is not a Ray Bar menu');
        return;
      }
      undoable('Menu imported', function () {
        menu = RB.normalize(data);
      });
    };
    reader.readAsText(file);
  });

  document.getElementById('reset').addEventListener('click', function () {
    undoable('Started over with the sample menu', function () {
      menu = RB.sampleMenu();
    });
  });

  /* ---------- Start ---------- */

  renderAll();
  if (canSave && !RB.readRaw()) RB.save(menu);
})();
