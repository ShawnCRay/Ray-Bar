/*
 * Ray Bar booth sign: shared data layer.
 * Holds the product list, the starting lineup, saving the draft on this
 * device, and publishing through GitHub. The sign (index.html) and the
 * editor (edit.html) both load this file first.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'raybar.booth.draft.v1';
  var PUBLISHED_KEY = 'raybar.booth.published.v1';
  // Shared with the home bar menu editor, so a device connected there is connected here too.
  var GITHUB_KEY = 'raybar.github.v1';
  var CONFIG = window.BoothConfig || null;

  var THEMES = [
    { id: 'espresso', name: 'Espresso (dark)' },
    { id: 'cream', name: 'Cream (light)' }
  ];

  var LAYOUTS = [
    { id: 'cards', name: 'Photo cards' },
    { id: 'list', name: 'Price list' }
  ];

  var COLUMN_CHOICES = ['auto', '1', '2', '3', '4', '5', '6'];

  var PAYMENT_METHODS = ['Cash', 'Card', 'Apple Pay', 'Google Pay', 'Venmo', 'Zelle', 'PayPal', 'Cash App'];

  /* Suggestions for the little label on a product. Anything else can be typed. */
  var BADGES = ['New', 'Best seller', 'Fan favorite', 'Limited', 'Seasonal', 'Show special', 'Last few'];

  var SITE = 'https://raybarboozyextracts.com';

  function uid() {
    return Math.random().toString(36).slice(2, 10);
  }

  function ids(list) {
    return list.map(function (x) { return x.id; });
  }

  function product(id, name, price, photo, extra) {
    return Object.assign({
      id: id,
      name: name,
      size: '',
      description: '',
      price: price,
      salePrice: '',
      badge: '',
      photo: photo ? 'img/products/' + photo + '.webp' : '',
      available: true
    }, extra || {});
  }

  /* The lineup from raybarboozyextracts.com, used until something is published. */
  function sampleMenu() {
    return {
      version: 1,
      brand: {
        name: 'Ray Bar',
        subtitle: 'Boozy Extracts',
        tagline: 'Handcrafted Cocktail Essentials',
        showLogo: true
      },
      show: {
        title: 'Elevate Every Pour.',
        subtitle: 'From the Ray-Bar to your bar.'
      },
      deals: [],
      payments: { methods: ['Cash', 'Card'], note: '' },
      qr: { show: true, url: SITE, label: 'Shop online anytime' },
      footer: '',
      settings: {
        theme: 'espresso',
        layout: 'cards',
        columns: 'auto',
        showPhotos: true,
        showDescriptions: true,
        soldOut: 'show'
      },
      sections: [
        {
          id: 'extracts',
          title: 'Extracts',
          note: 'Pure, handcrafted flavor extracts for cocktails and baking.',
          visible: true,
          items: [
            product('bourbon-vanilla-extract', 'Bourbon Vanilla Extract', '24', 'bourbon-vanilla-extract')
          ]
        },
        {
          id: 'bitters',
          title: 'Bitters',
          note: 'Complex, balanced bitters that complement without overpowering.',
          visible: true,
          items: [
            product('cherry-vanilla-bitters', 'Cherry Vanilla Bitters', '20', 'cherry-vanilla-bitters'),
            product('hibiscus-sour', 'Hibiscus Sour', '20', 'hibiscus-sour'),
            product('lavender-citrus', 'Lavender Citrus', '20', 'lavender-citrus'),
            product('spice-spice-baby', 'Spice Spice Baby', '20', 'spice-spice-baby'),
            product('spiced-orange', 'Spiced Orange', '20', 'spiced-orange')
          ]
        },
        {
          id: 'champagne-cubes',
          title: 'Champagne Cubes',
          note: 'Elevate your bubbles with our signature champagne cubes.',
          visible: true,
          items: [
            product('lavender-citrus-cubes', 'Lavender Citrus Cubes', '22', 'lavender-citrus-cubes'),
            product('yuzu-blood-orange', 'Yuzu & Blood Orange', '22', 'yuzu-blood-orange')
          ]
        }
      ],
      shows: [],
      updatedAt: ''
    };
  }

  /* ---------- Cleaning up whatever comes in ---------- */

  function str(value, fallback) {
    if (typeof value === 'string') return value;
    if (value === null || value === undefined) return fallback || '';
    return String(value);
  }

  function bool(value, fallback) {
    return typeof value === 'boolean' ? value : fallback;
  }

  function oneOf(value, allowed, fallback) {
    return allowed.indexOf(value) >= 0 ? value : fallback;
  }

  function obj(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function list(value) {
    return Array.isArray(value) ? value.filter(function (x) { return x && typeof x === 'object'; }) : [];
  }

  /* Only web addresses and paths inside the site make it onto the sign. */
  function safeUrl(value) {
    var text = str(value).trim();
    if (!text) return '';
    if (/^https?:\/\//i.test(text)) return text;
    if (/^[a-z][a-z0-9+.-]*:/i.test(text) || text.indexOf('//') === 0) return '';
    return text;
  }

  /* The part of the lineup that a saved show keeps (everything but the saved shows themselves). */
  function normalizeContent(src) {
    var brand = obj(src.brand);
    var show = obj(src.show);
    var payments = obj(src.payments);
    var qr = obj(src.qr);
    var settings = obj(src.settings);
    var methods = Array.isArray(payments.methods) ? payments.methods : [];

    return {
      brand: {
        name: str(brand.name, 'Ray Bar'),
        subtitle: str(brand.subtitle),
        tagline: str(brand.tagline),
        showLogo: bool(brand.showLogo, true)
      },
      show: {
        title: str(show.title),
        subtitle: str(show.subtitle)
      },
      deals: list(src.deals).map(function (d) {
        return { id: str(d.id) || uid(), text: str(d.text), visible: bool(d.visible, true) };
      }),
      payments: {
        methods: PAYMENT_METHODS.filter(function (m) { return methods.indexOf(m) >= 0; }),
        note: str(payments.note)
      },
      qr: {
        show: bool(qr.show, true),
        url: str(qr.url, SITE),
        label: str(qr.label)
      },
      footer: str(src.footer),
      settings: {
        theme: oneOf(settings.theme, ids(THEMES), 'espresso'),
        layout: oneOf(settings.layout, ids(LAYOUTS), 'cards'),
        columns: oneOf(String(settings.columns), COLUMN_CHOICES, 'auto'),
        showPhotos: bool(settings.showPhotos, true),
        showDescriptions: bool(settings.showDescriptions, true),
        soldOut: settings.soldOut === 'hide' ? 'hide' : 'show'
      },
      sections: list(src.sections).map(function (sec) {
        return {
          id: str(sec.id) || uid(),
          title: str(sec.title),
          note: str(sec.note),
          visible: bool(sec.visible, true),
          items: list(sec.items).map(function (it) {
            return {
              id: str(it.id) || uid(),
              name: str(it.name),
              size: str(it.size),
              description: str(it.description),
              price: str(it.price),
              salePrice: str(it.salePrice),
              badge: str(it.badge),
              photo: safeUrl(it.photo),
              available: bool(it.available, true)
            };
          })
        };
      })
    };
  }

  /* Accepts anything (an imported file, an older saved copy) and returns a clean lineup. */
  function normalize(input) {
    var src = obj(input);
    var clean = normalizeContent(src);
    clean.version = 1;
    clean.shows = list(src.shows).map(function (s) {
      return {
        id: str(s.id) || uid(),
        name: str(s.name),
        savedAt: str(s.savedAt),
        data: normalizeContent(obj(s.data))
      };
    });
    clean.updatedAt = str(src.updatedAt);
    return clean;
  }

  /* A copy of the current lineup to keep as a saved show. */
  function snapshot(menu) {
    return normalizeContent(JSON.parse(JSON.stringify(menu)));
  }

  /*
   * Loads a saved show into the lineup, keeping the list of saved shows.
   * Photos belong to the product rather than the show, so a product that's
   * still in the lineup keeps its current photo.
   */
  function applySnapshot(menu, data) {
    var photos = {};
    menu.sections.forEach(function (sec) {
      sec.items.forEach(function (it) { if (it.photo) photos[it.id] = it.photo; });
    });
    var next = normalize(Object.assign({}, JSON.parse(JSON.stringify(data)), { shows: menu.shows }));
    next.sections.forEach(function (sec) {
      sec.items.forEach(function (it) { if (photos[it.id]) it.photo = photos[it.id]; });
    });
    next.updatedAt = menu.updatedAt;
    return next;
  }

  /* ---------- Prices ---------- */

  /*
   * Plain numbers become dollar prices ("20" shows as $20, "19.5" as $19.50).
   * Anything else ("2 for $35", "Free taste") shows exactly as typed.
   */
  function priceParts(raw) {
    var text = str(raw).trim();
    if (!text) return null;
    var m = /^\$?\s*(\d{1,6})(?:[.,](\d{1,2}))?$/.exec(text);
    if (!m) return { text: text };
    var cents = m[2] ? (m[2].length === 1 ? m[2] + '0' : m[2]) : '';
    if (cents === '00') cents = '';
    return { symbol: '$', amount: m[1] + (cents ? '.' + cents : '') };
  }

  function formatPrice(raw) {
    var p = priceParts(raw);
    if (!p) return '';
    return p.text !== undefined ? p.text : p.symbol + p.amount;
  }

  /* ---------- Saving on this device ---------- */

  function storageAvailable() {
    try {
      var probe = '__raybar_probe__';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      return true;
    } catch (e) {
      return false;
    }
  }

  function readRaw() {
    try {
      return window.localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  /* Returns the draft saved on this device, or null when there isn't one. */
  function load() {
    var raw = readRaw();
    if (!raw) return null;
    try {
      return normalize(JSON.parse(raw));
    } catch (e) {
      return null;
    }
  }

  /* Saves the draft. Returns true on success. */
  function save(menu) {
    menu.updatedAt = new Date().toISOString();
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(menu));
      return true;
    } catch (e) {
      return false;
    }
  }

  function readJSON(key) {
    try {
      var raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function writeJSON(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  /* The last published lineup this device has seen: { sha, etag, menu } or null. */
  function loadPublished() {
    var saved = readJSON(PUBLISHED_KEY);
    if (!saved || !saved.menu) return null;
    return { sha: str(saved.sha), etag: str(saved.etag), menu: normalize(saved.menu) };
  }

  function savePublished(published) {
    return writeJSON(PUBLISHED_KEY, { sha: published.sha, etag: published.etag || '', menu: published.menu });
  }

  /* The GitHub key that lets this device publish (empty when not connected). */
  function getToken() {
    var saved = readJSON(GITHUB_KEY);
    return saved && typeof saved.token === 'string' ? saved.token : '';
  }

  function setToken(token) {
    if (token) return writeJSON(GITHUB_KEY, { token: token });
    try { window.localStorage.removeItem(GITHUB_KEY); } catch (e) { /* ignore */ }
    return true;
  }

  /* True when two lineups have the same content, ignoring when they were saved. */
  function sameMenu(a, b) {
    if (!a || !b) return false;
    var x = normalize(a);
    var y = normalize(b);
    x.updatedAt = '';
    y.updatedAt = '';
    return JSON.stringify(x) === JSON.stringify(y);
  }

  /* ---------- GitHub ---------- */

  function bytesToBase64(bytes) {
    var binary = '';
    for (var i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return window.btoa(binary);
  }

  function encodeBase64(text) {
    return bytesToBase64(new TextEncoder().encode(text));
  }

  function decodeBase64(encoded) {
    var binary = window.atob(String(encoded).replace(/\s/g, ''));
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function repoUrl(suffix) {
    return 'https://api.github.com/repos/' + CONFIG.owner + '/' + CONFIG.repo + (suffix || '');
  }

  function contentsUrl(path) {
    return repoUrl('/contents/' + path.split('/').map(encodeURIComponent).join('/'));
  }

  function headers(token, extra) {
    var h = { Accept: 'application/vnd.github+json' };
    if (token) h.Authorization = 'Bearer ' + token;
    return Object.assign(h, extra || {});
  }

  /* Turns a failed response into an Error carrying the HTTP status. */
  function failure(res) {
    return res.json().catch(function () { return {}; }).then(function (body) {
      var err = new Error((body && body.message) || ('GitHub answered ' + res.status));
      err.status = res.status;
      throw err;
    });
  }

  /*
   * Reads the published lineup. Resolves to one of:
   *   { status: 'ok', sha, etag, menu }
   *   { status: 'unchanged' }  (when etag still matches)
   *   { status: 'missing' }    (nothing published yet)
   */
  function fetchPublished(options) {
    options = options || {};
    if (!CONFIG) return Promise.resolve({ status: 'missing' });
    var h = headers(options.token);
    if (options.etag) h['If-None-Match'] = options.etag;
    var url = contentsUrl(CONFIG.path) + '?ref=' + encodeURIComponent(CONFIG.branch);
    return fetch(url, { headers: h, cache: 'no-store' }).then(function (res) {
      if (res.status === 304) return { status: 'unchanged' };
      if (res.status === 404) return { status: 'missing' };
      if (!res.ok) return failure(res);
      var etag = res.headers.get('ETag') || '';
      return res.json().then(function (data) {
        return {
          status: 'ok',
          sha: data.sha,
          etag: etag,
          menu: normalize(JSON.parse(decodeBase64(data.content || '')))
        };
      });
    });
  }

  /* Backup route if GitHub's hourly limit runs out. Can lag a few minutes behind. */
  function fetchPublishedRaw() {
    var url = 'https://raw.githubusercontent.com/' + CONFIG.owner + '/' + CONFIG.repo + '/' +
      CONFIG.branch + '/' + CONFIG.path + '?t=' + Date.now();
    return fetch(url, { cache: 'no-store' }).then(function (res) {
      if (!res.ok) return failure(res);
      return res.json().then(normalize);
    });
  }

  /* Makes the publishing branch from the default branch, if it's missing. */
  function createBranch(token) {
    return fetch(repoUrl(), { headers: headers(token), cache: 'no-store' }).then(function (res) {
      if (!res.ok) return failure(res);
      return res.json();
    }).then(function (repo) {
      return fetch(repoUrl('/git/ref/heads/' + encodeURIComponent(repo.default_branch)), { headers: headers(token), cache: 'no-store' });
    }).then(function (res) {
      if (!res.ok) return failure(res);
      return res.json();
    }).then(function (ref) {
      return fetch(repoUrl('/git/refs'), {
        method: 'POST',
        headers: headers(token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({ ref: 'refs/heads/' + CONFIG.branch, sha: ref.object.sha })
      });
    }).then(function (res) {
      // 422 here means another device made the branch a moment ago, which is fine.
      if (!res.ok && res.status !== 422) return failure(res);
    });
  }

  function branchMissing(err) {
    return err && (err.status === 404 || err.status === 422) && /branch/i.test(err.message);
  }

  /* Writes one file to the publishing branch. Resolves to GitHub's answer. */
  function putFile(path, base64, message, token, sha, retried) {
    var body = { message: message, content: base64, branch: CONFIG.branch };
    if (sha) body.sha = sha;
    return fetch(contentsUrl(path), {
      method: 'PUT',
      headers: headers(token, { 'Content-Type': 'application/json' }),
      body: JSON.stringify(body)
    }).then(function (res) {
      if (res.ok) return res.json();
      return failure(res);
    }).catch(function (err) {
      if (branchMissing(err) && !retried) {
        return createBranch(token).then(function () { return putFile(path, base64, message, token, sha, true); });
      }
      throw err;
    });
  }

  /* Publishes the lineup. `sha` is the version being replaced (omit for the first one). Resolves to { sha }. */
  function publishMenu(menu, token, sha) {
    var content = encodeBase64(JSON.stringify(menu, null, 2) + '\n');
    return putFile(CONFIG.path, content, 'Update the booth sign', token, sha).then(function (data) {
      return { sha: data.content.sha };
    });
  }

  /*
   * Saves a photo (a JPEG Blob) next to the published lineup and resolves to
   * its web address. The address names the exact commit, so it never changes.
   */
  function uploadPhoto(blob, token, name) {
    var path = CONFIG.photoDir + '/' + (name || uid()) + '.jpg';
    return blob.arrayBuffer().then(function (buffer) {
      return putFile(path, bytesToBase64(new Uint8Array(buffer)), 'Add a booth photo', token);
    }).then(function (data) {
      return 'https://raw.githubusercontent.com/' + CONFIG.owner + '/' + CONFIG.repo + '/' +
        data.commit.sha + '/' + path;
    });
  }

  /* Checks that GitHub accepts a key. */
  function checkToken(token) {
    return fetch(repoUrl(), { headers: headers(token), cache: 'no-store' }).then(function (res) {
      if (!res.ok) return failure(res);
      return res.json();
    });
  }

  window.Booth = {
    STORAGE_KEY: STORAGE_KEY,
    PUBLISHED_KEY: PUBLISHED_KEY,
    CONFIG: CONFIG,
    THEMES: THEMES,
    LAYOUTS: LAYOUTS,
    COLUMN_CHOICES: COLUMN_CHOICES,
    PAYMENT_METHODS: PAYMENT_METHODS,
    BADGES: BADGES,
    SITE: SITE,
    uid: uid,
    sampleMenu: sampleMenu,
    normalize: normalize,
    snapshot: snapshot,
    applySnapshot: applySnapshot,
    safeUrl: safeUrl,
    priceParts: priceParts,
    formatPrice: formatPrice,
    sameMenu: sameMenu,
    storageAvailable: storageAvailable,
    readRaw: readRaw,
    load: load,
    save: save,
    loadPublished: loadPublished,
    savePublished: savePublished,
    getToken: getToken,
    setToken: setToken,
    fetchPublished: fetchPublished,
    fetchPublishedRaw: fetchPublishedRaw,
    publishMenu: publishMenu,
    uploadPhoto: uploadPhoto,
    checkToken: checkToken
  };
})();
