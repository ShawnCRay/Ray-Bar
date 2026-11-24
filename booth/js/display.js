/*
 * Ray Bar booth sign (index.html).
 * Draws the products and prices, sizes everything to fill the screen, keeps
 * the screen awake, and picks up newly published prices on its own.
 * Press and hold anywhere to show the Edit button.
 */
(function () {
  'use strict';

  var B = window.Booth;
  var params = new URLSearchParams(window.location.search);
  var isPreview = params.has('preview');

  var stage = document.getElementById('stage');
  var controls = document.getElementById('controls');
  var hint = document.getElementById('hint');

  /*
   * The editor's preview shows the draft on this device. The real sign shows
   * the published lineup, and only falls back to the local draft if nothing
   * has been published yet.
   */
  var cachedPublished = isPreview ? null : B.loadPublished();
  var usingPublished = !!cachedPublished;
  var menu = cachedPublished ? cachedPublished.menu : (B.load() || B.sampleMenu());
  var lastRaw = B.readRaw();

  var LOGO = 'img/logo.webp';

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function has(text) {
    return !!(text && String(text).trim());
  }

  /* ---------- Pieces ---------- */

  function renderHeader() {
    var head = el('header', 'head');
    var brand = menu.brand;
    if (brand.showLogo) {
      var logo = el('img', 'logo');
      logo.src = LOGO;
      logo.alt = '';
      head.appendChild(logo);
    }
    var box = el('div', 'brand');
    if (has(brand.tagline)) box.appendChild(el('p', 'tagline', brand.tagline));
    box.appendChild(el('h1', 'name', brand.name || ' '));
    if (has(brand.subtitle)) box.appendChild(el('p', 'subtitle', brand.subtitle));
    head.appendChild(box);

    if (has(menu.show.title) || has(menu.show.subtitle)) {
      var show = el('div', 'show');
      if (has(menu.show.title)) show.appendChild(el('p', 'show-title display', menu.show.title));
      if (has(menu.show.subtitle)) show.appendChild(el('p', 'show-sub', menu.show.subtitle));
      head.appendChild(show);
    }
    return head;
  }

  function photo(item) {
    var box = el('div', 'photo');
    var img = el('img');
    img.alt = '';
    img.decoding = 'async';
    var src = B.safeUrl(item.photo);
    if (src) {
      img.src = src;
      img.addEventListener('error', function () {
        box.classList.add('blank');
        img.src = LOGO;
      }, { once: true });
    } else {
      box.classList.add('blank');
      img.src = LOGO;
    }
    box.appendChild(img);
    return box;
  }

  function priceNode(item) {
    if (!item.available) return el('span', 'soldout', 'Sold out');
    var now = B.priceParts(has(item.salePrice) ? item.salePrice : item.price);
    if (!now) return null;
    var wrap = el('span', 'price');
    if (has(item.salePrice) && has(item.price)) {
      wrap.appendChild(el('span', 'was', B.formatPrice(item.price)));
    }
    if (now.text !== undefined) {
      wrap.classList.add('words');
      wrap.appendChild(document.createTextNode(now.text));
    } else {
      wrap.appendChild(el('span', 'cur', now.symbol));
      wrap.appendChild(document.createTextNode(now.amount));
    }
    return wrap;
  }

  function visibleSections() {
    var settings = menu.settings;
    return menu.sections.filter(function (s) { return s.visible; }).map(function (section) {
      return {
        section: section,
        items: section.items.filter(function (it) {
          return has(it.name) && (it.available || settings.soldOut === 'show');
        })
      };
    }).filter(function (g) { return g.items.length; });
  }

  function renderCard(item, section) {
    var settings = menu.settings;
    var card = el('article', 'card' + (item.available ? '' : ' out'));
    if (settings.showPhotos) {
      var ph = photo(item);
      if (!item.available) ph.appendChild(el('span', 'stamp', 'Sold out'));
      card.appendChild(ph);
      if (has(item.badge) && item.available) card.appendChild(el('span', 'badge', item.badge));
    }
    var info = el('div', 'info');
    if (has(section.title)) info.appendChild(el('p', 'cat', section.title));
    info.appendChild(el('h3', 'pname', item.name));
    if (!settings.showPhotos && has(item.badge) && item.available) info.appendChild(el('span', 'badge', item.badge));
    if (settings.showDescriptions && has(item.description)) info.appendChild(el('p', 'desc', item.description));
    var bottom = el('div', 'bottom');
    var price = priceNode(item);
    if (price) bottom.appendChild(price);
    if (has(item.size)) bottom.appendChild(el('span', 'meta', item.size));
    if (bottom.childNodes.length) info.appendChild(bottom);
    card.appendChild(info);
    return card;
  }

  function renderRow(item) {
    var settings = menu.settings;
    var row = el('div', 'row' + (item.available ? '' : ' out'));
    if (settings.showPhotos) row.appendChild(photo(item));
    var text = el('div', 'text');
    var line = el('div', 'title-line');
    line.appendChild(el('h3', 'pname', item.name));
    if (has(item.badge) && item.available) line.appendChild(el('span', 'badge', item.badge));
    text.appendChild(line);
    if (has(item.size)) text.appendChild(el('span', 'meta', item.size));
    if (settings.showDescriptions && has(item.description)) text.appendChild(el('p', 'desc', item.description));
    row.appendChild(text);
    row.appendChild(priceNode(item) || el('span'));
    return row;
  }

  function renderGroup(group) {
    var section = group.section;
    var box = el('section', 'group');
    if (has(section.title)) box.appendChild(el('h2', null, section.title));
    if (has(section.note)) box.appendChild(el('p', 'note', section.note));
    var rows = el('div', 'rows' + (menu.settings.showPhotos ? '' : ' no-photos'));
    group.items.forEach(function (item) { rows.appendChild(renderRow(item)); });
    box.appendChild(rows);
    return box;
  }

  /* A QR code drawn as one SVG path, so it stays sharp at any size. */
  function qrSvg(text) {
    var qr = window.qrcode(0, 'M');
    if (window.qrcode.stringToBytesFuncs && window.qrcode.stringToBytesFuncs['UTF-8']) {
      window.qrcode.stringToBytes = window.qrcode.stringToBytesFuncs['UTF-8'];
    }
    qr.addData(text);
    qr.make();
    var count = qr.getModuleCount();
    var d = '';
    for (var r = 0; r < count; r++) {
      for (var c = 0; c < count; c++) {
        if (qr.isDark(r, c)) d += 'M' + c + ' ' + r + 'h1v1h-1z';
      }
    }
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + count + ' ' + count);
    svg.setAttribute('shape-rendering', 'crispEdges');
    svg.setAttribute('aria-hidden', 'true');
    var path = document.createElementNS(ns, 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', '#1a0f0a');
    svg.appendChild(path);
    return svg;
  }

  function displayUrl(url) {
    return url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');
  }

  function renderRail() {
    var rail = el('aside', 'rail');

    var deals = menu.deals.filter(function (d) { return d.visible && has(d.text); });
    if (deals.length) {
      var specials = el('section', 'specials');
      specials.appendChild(el('h3', 'eyebrow', deals.length > 1 ? 'Show specials' : 'Show special'));
      var ul = el('ul');
      deals.forEach(function (d) { ul.appendChild(el('li', null, d.text)); });
      specials.appendChild(ul);
      rail.appendChild(specials);
    }

    var url = B.safeUrl(menu.qr.url);
    if (menu.qr.show && /^https?:\/\//i.test(url)) {
      var qr = el('section', 'panel qr');
      var code = el('div', 'qr-code');
      try {
        code.appendChild(qrSvg(url));
        qr.appendChild(code);
      } catch (e) { /* address too long for a QR code; show the text only */ }
      var text = el('div', 'qr-text');
      if (has(menu.qr.label)) text.appendChild(el('p', 'qr-label', menu.qr.label));
      text.appendChild(el('p', 'qr-url', displayUrl(url)));
      qr.appendChild(text);
      rail.appendChild(qr);
    }

    var methods = menu.payments.methods;
    if (methods.length || has(menu.payments.note)) {
      var pay = el('section', 'panel pay');
      pay.appendChild(el('h3', 'eyebrow', 'We accept'));
      if (methods.length) {
        var box = el('div', 'methods');
        methods.forEach(function (m) { box.appendChild(el('span', 'method', m)); });
        pay.appendChild(box);
      }
      if (has(menu.payments.note)) pay.appendChild(el('p', 'pay-note', menu.payments.note));
      rail.appendChild(pay);
    }

    return rail.childNodes.length ? rail : null;
  }

  /* ---------- Draw ---------- */

  var groups = [];
  var cards = [];
  var board = null;
  var rail = null;
  var head = null;

  function render() {
    var settings = menu.settings;
    stage.setAttribute('data-theme', settings.theme);
    stage.setAttribute('data-layout', settings.layout);
    stage.textContent = '';

    head = renderHeader();
    stage.appendChild(head);

    var body = el('div', 'body');
    board = el('main', 'board');
    body.appendChild(board);
    rail = renderRail();
    if (rail) body.appendChild(rail);
    stage.appendChild(body);

    if (has(menu.footer)) stage.appendChild(el('footer', 'foot', menu.footer));

    var visible = visibleSections();
    cards = [];
    groups = [];
    if (settings.layout === 'cards') {
      visible.forEach(function (g) {
        g.items.forEach(function (item) { cards.push(renderCard(item, g.section)); });
      });
    } else {
      groups = visible.map(renderGroup);
    }

    document.title = (menu.brand.name.trim() || 'Ray Bar') + (has(menu.brand.subtitle) ? ' ' + menu.brand.subtitle.trim() : '');
    fit();
  }

  /* ---------- Fit everything to the screen ---------- */

  var MIN_SIZE = 6;
  var MAX_SIZE = 56;
  var MIN_CARD_EM = 7.2;   // narrowest a photo card may get
  var MIN_LIST_EM = 15;    // narrowest a price list column may get

  function setSize(px) {
    stage.style.fontSize = px + 'px';
  }

  function itemCount() {
    return menu.settings.layout === 'cards' ? cards.length : groups.length;
  }

  /* Lays the products out in the given number of columns. */
  function layout(columns) {
    board.textContent = '';
    if (!itemCount()) {
      board.appendChild(el('p', 'empty', 'New products coming soon'));
      return;
    }
    if (menu.settings.layout === 'cards') {
      var grid = el('div', 'grid' + (menu.settings.showPhotos ? '' : ' no-photos'));
      grid.style.setProperty('--cols', columns);
      cards.forEach(function (card) { grid.appendChild(card); });
      board.appendChild(grid);
      return;
    }
    // Price list: each group goes to whichever column is shortest so far.
    var wrap = el('div', 'cols');
    var cols = [];
    for (var i = 0; i < columns; i++) {
      var col = el('div', 'col');
      wrap.appendChild(col);
      cols.push(col);
    }
    board.appendChild(wrap);
    groups.forEach(function (g) { cols[0].appendChild(g); });
    var heights = groups.map(function (g) { return g.offsetHeight; });
    var gap = parseFloat(window.getComputedStyle(cols[0]).rowGap) || 0;
    var sums = cols.map(function () { return -gap; });
    groups.forEach(function (g, n) {
      var k = 0;
      for (var j = 1; j < sums.length; j++) {
        if (sums[j] < sums[k] - 0.5) k = j;
      }
      cols[k].appendChild(g);
      sums[k] += heights[n] + gap;
    });
  }

  function overflows(node, size) {
    if (!node) return false;
    var slack = Math.max(1, size * 0.05);
    return node.scrollHeight > node.clientHeight + slack || node.scrollWidth > node.clientWidth + slack;
  }

  /* `minEm` is how narrow a column may get, in em (0 for no limit). */
  function fits(size, columns, minEm) {
    setSize(size);
    if (overflows(head, size)) return false;
    if (minEm && board.clientWidth / size < columns * minEm) return false;
    layout(columns);
    if (board.clientHeight < size * 4) return false;
    return !overflows(board, size) && !overflows(rail, size);
  }

  function largestSizeFor(columns, limitByWidth) {
    var minEm = limitByWidth ? (menu.settings.layout === 'cards' ? MIN_CARD_EM : MIN_LIST_EM) : 0;
    var lo = MIN_SIZE;
    var hi = MAX_SIZE;
    if (!fits(lo, columns, minEm)) return limitByWidth ? 0 : lo;
    for (var i = 0; i < 12; i++) {
      var mid = (lo + hi) / 2;
      if (fits(mid, columns, minEm)) lo = mid; else hi = mid;
    }
    return lo;
  }

  function railPlacement() {
    var w = window.innerWidth;
    var h = window.innerHeight;
    stage.setAttribute('data-rail', w >= h * 1.12 ? 'side' : 'bottom');
  }

  function fit() {
    if (!board) return;
    railPlacement();
    var count = itemCount();
    var choice = menu.settings.columns;
    var best = { columns: 1, size: MIN_SIZE };

    if (choice === 'auto') {
      var isCards = menu.settings.layout === 'cards';
      var most = Math.max(1, Math.min(isCards ? 6 : 4, count));
      var options = [];
      for (var c = 1; c <= most; c++) {
        var size = largestSizeFor(c, true);
        if (size > 0) options.push({ columns: c, size: size, empty: isCards ? (Math.ceil(count / c) * c - count) : 0 });
      }
      var biggest = options.reduce(function (m, o) { return Math.max(m, o.size); }, 0);
      // Among the layouts with nearly the biggest text, take the one with the
      // fullest rows of cards, then the fewest columns.
      var found = false;
      options.forEach(function (o) {
        if (o.size < biggest * (isCards ? 0.88 : 0.96)) return;
        if (!found || o.empty < best.empty || (o.empty === best.empty && o.size > best.size * 1.04)) {
          best = o;
          found = true;
        }
      });
      if (!found) {
        var fallback = Math.min(menu.settings.layout === 'cards' ? 4 : 2, most);
        best = { columns: fallback, size: largestSizeFor(fallback, false) };
      }
    } else {
      var cols = Math.max(1, Math.min(Number(choice), Math.max(1, count)));
      best = { columns: cols, size: largestSizeFor(cols, false) };
    }

    setSize(Math.floor(best.size * 10) / 10);
    layout(best.columns);
    stage.setAttribute('data-columns', best.columns);
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

  /* ---------- Pick up changes ---------- */

  var POLL_MS = 30000; // how often the sign checks for newly published prices
  var SLOW_POLL_MS = 180000; // when nothing is published yet, or GitHub asks us to slow down
  var pollTimer = null;

  function show(next) {
    if (B.sameMenu(next, menu)) return;
    menu = next;
    render();
  }

  /* The draft saved on this device (used by the preview, and before anything is published). */
  function reloadLocal() {
    var raw = B.readRaw();
    if (raw === lastRaw) return;
    lastRaw = raw;
    show(B.load() || B.sampleMenu());
  }

  function scheduleCheck(ms) {
    clearTimeout(pollTimer);
    pollTimer = setTimeout(checkPublished, ms);
  }

  /* Asks GitHub whether new prices have been published. */
  function checkPublished() {
    clearTimeout(pollTimer);
    var cached = B.loadPublished();
    B.fetchPublished({ etag: cached && cached.etag, token: B.getToken() }).then(function (result) {
      if (result.status === 'ok') {
        B.savePublished(result);
        usingPublished = true;
        show(result.menu);
        scheduleCheck(POLL_MS);
      } else if (result.status === 'unchanged') {
        if (cached && !usingPublished) {
          usingPublished = true;
          show(cached.menu);
        }
        scheduleCheck(POLL_MS);
      } else {
        usingPublished = false;
        lastRaw = null;
        reloadLocal();
        scheduleCheck(SLOW_POLL_MS);
      }
    }).catch(function (err) {
      // Out of API calls for the hour: read the plain file instead and check less often.
      if (err && (err.status === 403 || err.status === 429)) {
        B.fetchPublishedRaw().then(function (raw) {
          usingPublished = true;
          show(raw);
        }).catch(function () { /* keep showing what we have */ });
        scheduleCheck(SLOW_POLL_MS);
      } else {
        scheduleCheck(POLL_MS * 2); // probably offline; keep showing what we have
      }
    });
  }

  function reload() {
    if (isPreview || !B.CONFIG) reloadLocal();
    else checkPublished();
  }

  window.addEventListener('storage', function (e) {
    if (isPreview || !usingPublished) {
      if (e.key === B.STORAGE_KEY || e.key === null) reloadLocal();
      return;
    }
    // The editor on this same device just published.
    if (e.key === B.PUBLISHED_KEY) {
      var published = B.loadPublished();
      if (published) show(published.menu);
    }
  });

  setInterval(function () {
    if (isPreview || !usingPublished) reloadLocal();
  }, 2500);

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') reload();
  });

  if (!isPreview && B.CONFIG) checkPublished();

  window.BoothSign = { reload: reload, fit: fit };

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

    stage.addEventListener('pointerdown', function (e) {
      keepAwake();
      startX = e.clientX;
      startY = e.clientY;
      clearTimeout(pressTimer);
      pressTimer = setTimeout(showControls, 700);
      if (controls.classList.contains('show')) hideControls();
    });
    stage.addEventListener('pointermove', function (e) {
      if (Math.abs(e.clientX - startX) > 12 || Math.abs(e.clientY - startY) > 12) cancelPress();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (type) {
      stage.addEventListener(type, cancelPress);
    });
    stage.addEventListener('contextmenu', function (e) { e.preventDefault(); });

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
    try { seenHint = window.sessionStorage.getItem('raybar.booth.hint') === '1'; } catch (e) { /* ignore */ }
    if (!seenHint) {
      setTimeout(function () { hint.classList.add('show'); }, 600);
      setTimeout(function () { hint.classList.remove('show'); }, 5200);
      try { window.sessionStorage.setItem('raybar.booth.hint', '1'); } catch (e) { /* ignore */ }
    }

    keepAwake();

    // Keeps the sign working with no internet once it has loaded here once.
    if ('serviceWorker' in navigator && window.isSecureContext) {
      navigator.serviceWorker.register('sw.js').catch(function () { /* online-only is fine */ });
    }
  }

  render();
})();
