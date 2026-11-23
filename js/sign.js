/*
 * Ray Bar sign (index.html).
 * Draws the menu as a wall of salvaged signs, sizes it to fill the screen,
 * keeps the screen awake, and picks up edits automatically.
 * Press and hold anywhere to show the Edit button.
 */
(function () {
  'use strict';

  var RB = window.RayBar;
  var params = new URLSearchParams(window.location.search);
  var isPreview = params.has('preview');

  var wall = document.getElementById('wall');
  var controls = document.getElementById('controls');
  var hint = document.getElementById('hint');

  var menu = RB.load() || RB.sampleMenu();
  var lastRaw = RB.readRaw();

  /* ---------- Seeded randomness, so the wall looks the same every time ---------- */

  function hash(text) {
    var h = 2166136261;
    for (var i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function seeded(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function between(rand, lo, hi) {
    return lo + rand() * (hi - lo);
  }

  /* A random tilt of at least `lo` degrees, either way. */
  function tilt(rand, lo, hi) {
    return (rand() < 0.5 ? -1 : 1) * between(rand, lo, hi);
  }

  function pick(rand, list) {
    return list[Math.floor(rand() * list.length)];
  }

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  /* ---------- Pieces of the wall ---------- */

  var TILE_STYLES = ['marquee', 'rust', 'enamel', 'wood', 'caution', 'cardboard', 'diner', 'letterboard', 'spray', 'chalk'];

  /* The bar name, one mismatched salvaged letter at a time. */
  function renderName(name) {
    var h1 = el('h1', 'name');
    h1.setAttribute('aria-label', name);
    var rand = seeded(hash(name.toUpperCase()));
    var deck = [];
    var last = '';

    // Deal plate styles from a shuffled deck so neighbours never match.
    function nextStyle() {
      if (!deck.length) {
        deck = TILE_STYLES.slice();
        for (var i = deck.length - 1; i > 0; i--) {
          var j = Math.floor(rand() * (i + 1));
          var tmp = deck[i]; deck[i] = deck[j]; deck[j] = tmp;
        }
        if (deck[deck.length - 1] === last) deck.unshift(deck.pop());
      }
      last = deck.pop();
      return last;
    }

    name.toUpperCase().trim().split(/\s+/).forEach(function (wordText) {
      if (!wordText) return;
      var word = el('span', 'word');
      Array.from(wordText).forEach(function (ch) {
        var tile = el('span', 'tile t-' + nextStyle());
        tile.setAttribute('aria-hidden', 'true');
        tile.style.setProperty('--rot', tilt(rand, 2.5, 8).toFixed(1) + 'deg');
        tile.style.setProperty('--dy', between(rand, -0.09, 0.09).toFixed(2) + 'em');
        tile.style.fontSize = between(rand, 0.84, 1.06).toFixed(2) + 'em';
        tile.appendChild(el('span', 'ch', ch));
        word.appendChild(tile);
      });
      h1.appendChild(word);
    });
    return h1;
  }

  /* A neon tube sign with one letter on the fritz. */
  function renderNeon(text) {
    var box = el('div', 'neon');
    box.setAttribute('aria-label', text);
    var chars = Array.from(text.toUpperCase());
    var rand = seeded(hash(text));
    var dead = chars.length > 1 ? Math.floor(rand() * chars.length) : -1;
    for (var guard = 0; dead >= 0 && /\s/.test(chars[dead]) && guard < chars.length; guard++) {
      dead = (dead + 1) % chars.length;
    }
    chars.forEach(function (ch, i) {
      var span = el('span', i === dead ? 'dead' : null, ch);
      span.setAttribute('aria-hidden', 'true');
      box.appendChild(span);
    });
    return box;
  }

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var CAP_POINTS = (function () {
    var pts = [];
    var teeth = 21;
    for (var i = 0; i < teeth * 2; i++) {
      var angle = (Math.PI * i) / teeth - Math.PI / 2;
      var radius = i % 2 ? 10.3 : 12;
      pts.push((12 + radius * Math.cos(angle)).toFixed(2) + ',' + (12 + radius * Math.sin(angle)).toFixed(2));
    }
    return pts.join(' ');
  })();

  /* A little bottle cap, for prices. */
  function capIcon() {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', 'cap');
    svg.setAttribute('aria-hidden', 'true');
    var rim = document.createElementNS(SVG_NS, 'polygon');
    rim.setAttribute('points', CAP_POINTS);
    rim.setAttribute('fill', 'currentColor');
    var ring = document.createElementNS(SVG_NS, 'circle');
    ring.setAttribute('cx', '12');
    ring.setAttribute('cy', '12');
    ring.setAttribute('r', '7.2');
    ring.setAttribute('fill', 'none');
    ring.setAttribute('stroke', 'rgba(0,0,0,.38)');
    ring.setAttribute('stroke-width', '1.4');
    svg.appendChild(rim);
    svg.appendChild(ring);
    return svg;
  }

  function renderPrice(price) {
    var text = price.trim();
    var wrap = el('span', 'price');
    if (/^\d+([.,]\d+)?$/.test(text)) {
      wrap.setAttribute('aria-label', text + ' caps');
      wrap.appendChild(el('span', null, text));
      wrap.appendChild(capIcon());
    } else {
      wrap.textContent = text;
    }
    return wrap;
  }

  function renderItem(item, settings) {
    var row = el('div', 'item' + (item.available ? '' : ' out') + (item.featured ? ' featured' : ''));
    var line = el('div', 'line');
    var name = el('span', 'iname');
    if (item.featured) name.appendChild(el('span', 'star', '★'));
    name.appendChild(document.createTextNode(item.name));
    line.appendChild(name);
    if (!item.available) line.appendChild(el('span', 'stamp', 'Out'));
    if (settings.showPrices && item.price.trim()) {
      line.appendChild(el('span', 'leader'));
      line.appendChild(renderPrice(item.price));
    }
    row.appendChild(line);
    if (settings.showDescriptions && item.description.trim()) {
      row.appendChild(el('p', 'desc', item.description));
    }
    return row;
  }

  function renderSection(section, index, settings) {
    var items = section.items.filter(function (it) {
      return it.name.trim() && (it.available || settings.soldOut === 'show');
    });
    if (!items.length) return null;

    var style = RB.resolveStyle(section, index);
    var card = el('section', 'sign s-' + style);
    var rand = seeded(hash(section.id));
    card.style.setProperty('--tilt', tilt(rand, 0.8, 2.3).toFixed(2) + 'deg');
    card.style.setProperty('--w', between(rand, 86, 100).toFixed(1) + '%');
    card.style.setProperty('--align', pick(rand, ['flex-start', 'center', 'flex-end']));

    if (style === 'cardboard') {
      card.appendChild(el('span', 'tape tape-l'));
      card.appendChild(el('span', 'tape tape-r'));
    }
    if (section.title.trim()) card.appendChild(el('h2', null, section.title));
    if (section.note.trim()) card.appendChild(el('p', 'note', section.note));
    items.forEach(function (it) {
      card.appendChild(renderItem(it, settings));
    });
    return card;
  }

  function render() {
    var settings = menu.settings;
    wall.setAttribute('data-wall', settings.wall);
    wall.textContent = '';

    var head = el('header', 'head');
    var center = el('div', 'head-center');
    center.appendChild(renderName(menu.bar.name || ' '));
    if (menu.bar.tagline.trim()) center.appendChild(el('p', 'tagline', menu.bar.tagline));
    var right = el('div', 'head-side right');
    if (menu.bar.neon.trim()) right.appendChild(renderNeon(menu.bar.neon.trim()));
    head.appendChild(el('div', 'head-side'));
    head.appendChild(center);
    head.appendChild(right);
    wall.appendChild(head);

    cards = [];
    menu.sections.forEach(function (section, i) {
      if (!section.visible) return;
      var card = renderSection(section, i, settings);
      if (card) cards.push(card);
    });
    emptyNode = el('p', 'empty', 'Menu coming soon');
    wall.appendChild(el('main', 'menu'));

    if (menu.bar.footer.trim()) wall.appendChild(el('footer', 'foot', menu.bar.footer));

    document.title = menu.bar.name.trim() || 'Bar menu';
    fit();
  }

  /* ---------- Hang the signs and fit the wall to the screen ---------- */

  var cards = [];
  var emptyNode = null;

  var MIN_SIZE = 6;
  var MAX_SIZE = 46;
  var MIN_COLUMN_EM = 14;

  function setSize(px) {
    wall.style.fontSize = px + 'px';
  }

  /*
   * Hangs the signs in the given number of columns, each sign going to
   * whichever column is shortest so far. Returns how tall the tallest
   * column is and how much height is available.
   */
  function layout(columns) {
    var board = wall.querySelector('.menu');
    board.textContent = '';
    if (!cards.length) {
      board.appendChild(emptyNode);
      return { tallest: 0, available: board.clientHeight };
    }
    var cols = [];
    for (var i = 0; i < columns; i++) {
      var col = el('div', 'col');
      board.appendChild(col);
      cols.push(col);
    }
    cards.forEach(function (card) { cols[0].appendChild(card); });
    var heights = cards.map(function (card) { return card.offsetHeight; });
    var gap = parseFloat(window.getComputedStyle(cols[0]).rowGap) || 0;
    var sums = cols.map(function () { return -gap; });
    cards.forEach(function (card, n) {
      var k = 0;
      for (var j = 1; j < sums.length; j++) {
        if (sums[j] < sums[k] - 0.5) k = j;
      }
      cols[k].appendChild(card);
      sums[k] += heights[n] + gap;
    });
    return { tallest: Math.max.apply(null, sums), available: cols[0].clientHeight };
  }

  function fits(size, columns) {
    setSize(size);
    var head = wall.querySelector('.head');
    // Small overhangs from tilted letters are fine; real overflow is not.
    if (head.scrollWidth > head.clientWidth + size * 0.6) return false;
    var result = layout(columns);
    if (result.available < size * 4) return false;
    return result.tallest <= result.available;
  }

  function largestSizeFor(columns, limitByWidth) {
    var lo = MIN_SIZE;
    var hi = MAX_SIZE;
    if (limitByWidth) {
      var width = wall.querySelector('.menu').clientWidth;
      hi = Math.min(hi, width / (columns * MIN_COLUMN_EM));
      if (hi < lo) return 0;
    }
    if (!fits(lo, columns)) return limitByWidth ? 0 : lo;
    for (var i = 0; i < 12; i++) {
      var mid = (lo + hi) / 2;
      if (fits(mid, columns)) lo = mid; else hi = mid;
    }
    return lo;
  }

  function fit() {
    if (!wall.querySelector('.menu')) return;
    var choice = menu.settings.columns;
    var best = { columns: 1, size: MIN_SIZE };

    if (choice === 'auto') {
      var found = false;
      var most = Math.max(1, Math.min(4, cards.length));
      for (var c = 1; c <= most; c++) {
        var size = largestSizeFor(c, true);
        // Prefer fewer columns unless more columns gives clearly bigger text.
        if (size > 0 && (!found || size > best.size * 1.04)) {
          best = { columns: c, size: size };
          found = true;
        }
      }
      if (!found) best = { columns: Math.min(2, most), size: largestSizeFor(Math.min(2, most), false) };
    } else {
      var cols = Number(choice);
      best = { columns: cols, size: largestSizeFor(cols, false) };
    }

    var finalSize = Math.floor(best.size * 10) / 10;
    setSize(finalSize);
    layout(best.columns);
    wall.setAttribute('data-columns', best.columns);
  }

  var resizeTimer = null;
  function scheduleFit() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(fit, 120);
  }

  window.addEventListener('resize', scheduleFit);
  window.addEventListener('orientationchange', scheduleFit);
  if (document.fonts) {
    document.fonts.ready.then(fit);
    if (document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', scheduleFit);
  }

  /* ---------- Pick up edits ---------- */

  function reload() {
    var raw = RB.readRaw();
    if (raw === lastRaw) return;
    lastRaw = raw;
    menu = RB.load() || RB.sampleMenu();
    render();
  }

  window.addEventListener('storage', function (e) {
    if (e.key === RB.STORAGE_KEY || e.key === null) reload();
  });
  setInterval(reload, 2500);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') reload();
  });

  window.RayBarSign = { reload: reload, fit: fit };

  /* ---------- Keep the screen on ---------- */

  var wakeLock = null;
  function keepAwake() {
    if (isPreview || wakeLock || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
    navigator.wakeLock.request('screen').then(function (lock) {
      wakeLock = lock;
      lock.addEventListener('release', function () { wakeLock = null; });
    }).catch(function () { /* not allowed right now, try again on next tap */ });
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') keepAwake();
  });

  /* ---------- Press and hold to reveal the Edit button ---------- */

  var hideTimer = null;
  function showControls() {
    controls.classList.add('show');
    controls.setAttribute('aria-hidden', 'false');
    hint.classList.remove('show');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hideControls, 8000);
  }
  function hideControls() {
    controls.classList.remove('show');
    controls.setAttribute('aria-hidden', 'true');
  }

  if (!isPreview) {
    var pressTimer = null;
    var startX = 0;
    var startY = 0;
    var cancelPress = function () { clearTimeout(pressTimer); };

    wall.addEventListener('pointerdown', function (e) {
      keepAwake();
      startX = e.clientX;
      startY = e.clientY;
      clearTimeout(pressTimer);
      pressTimer = setTimeout(showControls, 700);
      if (controls.classList.contains('show')) hideControls();
    });
    wall.addEventListener('pointermove', function (e) {
      if (Math.abs(e.clientX - startX) > 12 || Math.abs(e.clientY - startY) > 12) cancelPress();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (type) {
      wall.addEventListener(type, cancelPress);
    });
    wall.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'e' || e.key === 'E') window.location.href = 'edit.html';
      if (e.key === 'Escape') hideControls();
    });

    document.getElementById('close-controls').addEventListener('click', hideControls);

    var fsButton = document.getElementById('fullscreen');
    var root = document.documentElement;
    var standalone = window.navigator.standalone === true ||
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
    var requestFs = root.requestFullscreen || root.webkitRequestFullscreen;
    if (requestFs && !standalone) {
      fsButton.hidden = false;
      fsButton.addEventListener('click', function () {
        var p = requestFs.call(root);
        if (p && p.catch) p.catch(function () {});
        hideControls();
      });
    }

    // A one-time nudge so the hidden gesture is discoverable.
    var seenHint = false;
    try { seenHint = window.sessionStorage.getItem('raybar.hint') === '1'; } catch (e) { /* ignore */ }
    if (!seenHint) {
      setTimeout(function () { hint.classList.add('show'); }, 600);
      setTimeout(function () { hint.classList.remove('show'); }, 5200);
      try { window.sessionStorage.setItem('raybar.hint', '1'); } catch (e) { /* ignore */ }
    }

    keepAwake();
  }

  render();
})();
