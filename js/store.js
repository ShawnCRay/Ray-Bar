/*
 * Ray Bar shared data layer.
 * Holds the menu model, the sample menu, and saving/loading from the
 * browser's local storage. Both the sign (index.html) and the editor
 * (edit.html) load this file first.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'raybar.menu.v1';

  /* Salvaged sign styles a section can be painted on. */
  var SIGN_STYLES = [
    { id: 'rust', name: 'Rusted metal' },
    { id: 'wood', name: 'Painted wood' },
    { id: 'enamel', name: 'Enamel plate' },
    { id: 'caution', name: 'Hazard yellow' },
    { id: 'cardboard', name: 'Cardboard' },
    { id: 'chalk', name: 'Chalkboard' },
    { id: 'diner', name: 'Atomic diner' }
  ];

  /* The wall the signs hang on. */
  var WALLS = [
    { id: 'concrete', name: 'Concrete' },
    { id: 'wood', name: 'Wood paneling' },
    { id: 'metal', name: 'Corrugated metal' }
  ];

  var COLUMN_CHOICES = ['auto', '1', '2', '3', '4'];

  function uid() {
    return Math.random().toString(36).slice(2, 10);
  }

  function ids(list) {
    return list.map(function (x) { return x.id; });
  }

  /* The style a section actually uses ("auto" cycles through the list). */
  function resolveStyle(section, index) {
    if (section.style && section.style !== 'auto') return section.style;
    return SIGN_STYLES[index % SIGN_STYLES.length].id;
  }

  function item(name, description, price, extra) {
    return Object.assign(
      { id: uid(), name: name, description: description || '', price: price || '', available: true, featured: false },
      extra || {}
    );
  }

  function sampleMenu() {
    return {
      version: 1,
      bar: {
        name: 'Ray Bar',
        tagline: 'Drinks for the end of the world',
        neon: 'OPEN',
        footer: 'Caps only · No tabs · Drink responsibly'
      },
      settings: {
        wall: 'concrete',
        columns: 'auto',
        showPrices: true,
        showDescriptions: true,
        soldOut: 'show'
      },
      sections: [
        {
          id: 'sample-cocktails',
          title: 'Cocktails',
          note: '',
          style: 'rust',
          visible: true,
          items: [
            item('Old Fashioned', 'Pre-war recipe. Bourbon, sugar, bitters, orange peel', '12', { featured: true }),
            item('Margarita', 'Tequila, fresh lime, orange liqueur, salted rim', '10'),
            item('Negroni', 'Gin, Campari, sweet vermouth. Bitter as the wasteland', '11'),
            item('Espresso Martini', 'Vodka, espresso, coffee liqueur. Keeps you up past curfew', '12'),
            item('Paloma', 'Tequila, grapefruit, lime, soda', '10'),
            item('Whiskey Sour', 'Rye, lemon, sugar, egg white', '11', { available: false })
          ]
        },
        {
          id: 'sample-beer',
          title: 'Beer',
          note: 'Ask what\'s cold',
          style: 'wood',
          visible: true,
          items: [
            item('Hazy IPA', 'Citrus and pine', '6'),
            item('Mexican Lager', 'Crisp, with a lime', '5'),
            item('Stout', 'Dark as a bunker with the lights out', '6')
          ]
        },
        {
          id: 'sample-wine',
          title: 'Wine',
          note: '',
          style: 'enamel',
          visible: true,
          items: [
            item('Cabernet', 'Full-bodied red, salvaged from a cellar', '9'),
            item('Sauvignon Blanc', 'Crisp white, kept cold', '9'),
            item('Prosecco', 'Dry Italian bubbles', '10')
          ]
        },
        {
          id: 'sample-zero-proof',
          title: 'Zero Proof',
          note: 'Zero rads, zero proof',
          style: 'caution',
          visible: true,
          items: [
            item('Ginger Mule', 'Ginger beer, lime, mint', '4'),
            item('Clean Water', 'Filtered. Probably.', '1')
          ]
        }
      ],
      updatedAt: ''
    };
  }

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

  /* Accepts anything (an imported file, an older saved copy) and returns a clean menu. */
  function normalize(input) {
    var src = input && typeof input === 'object' ? input : {};
    var bar = src.bar && typeof src.bar === 'object' ? src.bar : {};
    var settings = src.settings && typeof src.settings === 'object' ? src.settings : {};
    var sections = Array.isArray(src.sections) ? src.sections : [];
    var styleIds = ['auto'].concat(ids(SIGN_STYLES));

    return {
      version: 1,
      bar: {
        name: str(bar.name, 'Ray Bar'),
        tagline: str(bar.tagline),
        neon: str(bar.neon),
        footer: str(bar.footer)
      },
      settings: {
        wall: oneOf(settings.wall, ids(WALLS), 'concrete'),
        columns: oneOf(String(settings.columns), COLUMN_CHOICES, 'auto'),
        showPrices: bool(settings.showPrices, true),
        showDescriptions: bool(settings.showDescriptions, true),
        soldOut: settings.soldOut === 'hide' ? 'hide' : 'show'
      },
      sections: sections.filter(function (s) { return s && typeof s === 'object'; }).map(function (sec) {
        var items = Array.isArray(sec.items) ? sec.items : [];
        return {
          id: str(sec.id) || uid(),
          title: str(sec.title),
          note: str(sec.note),
          style: oneOf(sec.style, styleIds, 'auto'),
          visible: bool(sec.visible, true),
          items: items.filter(function (i) { return i && typeof i === 'object'; }).map(function (it) {
            return {
              id: str(it.id) || uid(),
              name: str(it.name),
              description: str(it.description),
              price: str(it.price),
              available: bool(it.available, true),
              featured: bool(it.featured, false)
            };
          })
        };
      }),
      updatedAt: str(src.updatedAt)
    };
  }

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

  /* Returns the saved menu, or null when nothing has been saved yet. */
  function load() {
    var raw = readRaw();
    if (!raw) return null;
    try {
      return normalize(JSON.parse(raw));
    } catch (e) {
      return null;
    }
  }

  /* Saves the menu. Returns true on success. */
  function save(menu) {
    menu.updatedAt = new Date().toISOString();
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(menu));
      return true;
    } catch (e) {
      return false;
    }
  }

  /* ---------- The published menu, shared between devices through GitHub ---------- */

  var PUBLISHED_KEY = 'raybar.published.v1';
  var GITHUB_KEY = 'raybar.github.v1';
  var CONFIG = window.RayBarConfig || null;

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

  /* The last published menu this device has seen: { sha, etag, menu } or null. */
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

  /* True when two menus have the same content, ignoring when they were saved. */
  function sameMenu(a, b) {
    if (!a || !b) return false;
    var x = normalize(a);
    var y = normalize(b);
    x.updatedAt = '';
    y.updatedAt = '';
    return JSON.stringify(x) === JSON.stringify(y);
  }

  function encodeBase64(text) {
    var bytes = new TextEncoder().encode(text);
    var binary = '';
    for (var i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return window.btoa(binary);
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

  function fileUrl() {
    return repoUrl('/contents/' + encodeURIComponent(CONFIG.path));
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
   * Reads the published menu. Resolves to one of:
   *   { status: 'ok', sha, etag, menu }
   *   { status: 'unchanged' }  (when etag still matches)
   *   { status: 'missing' }    (nothing published yet)
   */
  function fetchPublished(options) {
    options = options || {};
    if (!CONFIG) return Promise.resolve({ status: 'missing' });
    var h = headers(options.token);
    if (options.etag) h['If-None-Match'] = options.etag;
    var url = fileUrl() + '?ref=' + encodeURIComponent(CONFIG.branch);
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

  /* Makes the menu branch from the default branch, if it's missing. */
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
      if (!res.ok) return failure(res);
    });
  }

  /* Publishes the menu. `sha` is the version being replaced (omit for the first one). Resolves to { sha }. */
  function publishMenu(menu, token, sha, retried) {
    var body = {
      message: 'Update the menu',
      content: encodeBase64(JSON.stringify(menu, null, 2) + '\n'),
      branch: CONFIG.branch
    };
    if (sha) body.sha = sha;
    return fetch(fileUrl(), {
      method: 'PUT',
      headers: headers(token, { 'Content-Type': 'application/json' }),
      body: JSON.stringify(body)
    }).then(function (res) {
      if (res.ok) return res.json().then(function (data) { return { sha: data.content.sha }; });
      return failure(res);
    }).catch(function (err) {
      var branchMissing = err && (err.status === 404 || err.status === 422) && /branch/i.test(err.message);
      if (branchMissing && !retried) {
        return createBranch(token).then(function () { return publishMenu(menu, token, sha, true); });
      }
      throw err;
    });
  }

  /* Checks that GitHub accepts a key. */
  function checkToken(token) {
    return fetch(repoUrl(), { headers: headers(token), cache: 'no-store' }).then(function (res) {
      if (!res.ok) return failure(res);
      return res.json();
    });
  }

  window.RayBar = {
    STORAGE_KEY: STORAGE_KEY,
    PUBLISHED_KEY: PUBLISHED_KEY,
    CONFIG: CONFIG,
    SIGN_STYLES: SIGN_STYLES,
    WALLS: WALLS,
    COLUMN_CHOICES: COLUMN_CHOICES,
    uid: uid,
    resolveStyle: resolveStyle,
    sampleMenu: sampleMenu,
    normalize: normalize,
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
    checkToken: checkToken
  };
})();
