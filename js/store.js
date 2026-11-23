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

  window.RayBar = {
    STORAGE_KEY: STORAGE_KEY,
    SIGN_STYLES: SIGN_STYLES,
    WALLS: WALLS,
    COLUMN_CHOICES: COLUMN_CHOICES,
    uid: uid,
    resolveStyle: resolveStyle,
    sampleMenu: sampleMenu,
    normalize: normalize,
    storageAvailable: storageAvailable,
    readRaw: readRaw,
    load: load,
    save: save
  };
})();
