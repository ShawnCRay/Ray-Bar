/*
 * Keeps the booth sign working at shows with no internet.
 * The sign's own files are saved on the device the first time it loads.
 * After that each file is fetched fresh when there's a connection, and the
 * saved copy is used when there isn't. Published prices are kept by the
 * sign itself, so GitHub's API is left alone here.
 */
var CACHE = 'raybar-booth-v1';
var NETWORK_WAIT_MS = 4000;

var FILES = [
  './',
  'index.html',
  'edit.html',
  'manifest.webmanifest',
  'css/fonts.css',
  'css/display.css',
  'css/editor.css',
  'js/config.js',
  'js/store.js',
  'js/display.js',
  'js/editor.js',
  'js/vendor/qrcode.js',
  'fonts/barlow-condensed-500.woff2',
  'fonts/barlow-condensed-600.woff2',
  'fonts/barlow-condensed-700.woff2',
  'fonts/inter-variable.woff2',
  'img/logo.webp',
  'img/products/bourbon-vanilla-extract.webp',
  'img/products/cherry-vanilla-bitters.webp',
  'img/products/hibiscus-sour.webp',
  'img/products/lavender-citrus.webp',
  'img/products/spice-spice-baby.webp',
  'img/products/spiced-orange.webp',
  'img/products/lavender-citrus-cubes.webp',
  'img/products/yuzu-blood-orange.webp',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(FILES.map(function (f) { return new Request(f, { cache: 'reload' }); }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) {
        return k.indexOf('raybar-booth-') === 0 && k !== CACHE;
      }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

/* Tries the network, but gives up after a few seconds on a weak signal and uses the saved copy. */
function networkFirst(request) {
  return caches.open(CACHE).then(function (cache) {
    var fromNetwork = fetch(request).then(function (res) {
      if (res && res.ok) cache.put(request, res.clone());
      return res;
    });
    var fallback = new Promise(function (resolve) {
      setTimeout(resolve, NETWORK_WAIT_MS);
    }).then(function () {
      return cache.match(request, { ignoreSearch: true });
    });
    return Promise.race([
      fromNetwork.catch(function () { return cache.match(request, { ignoreSearch: true }); }),
      fallback.then(function (saved) { return saved || fromNetwork; })
    ]).then(function (res) {
      return res || fromNetwork;
    });
  });
}

/* Photos added from the editor never change once uploaded, so a saved copy is always good. */
function cacheFirst(request) {
  return caches.open(CACHE).then(function (cache) {
    return cache.match(request).then(function (saved) {
      if (saved) return saved;
      return fetch(request).then(function (res) {
        if (res && (res.ok || res.type === 'opaque')) cache.put(request, res.clone());
        return res;
      });
    });
  });
}

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;
  var url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (url.pathname.indexOf(new URL('./', self.registration.scope).pathname) !== 0) return;
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.hostname === 'raw.githubusercontent.com' && url.pathname.indexOf('/booth-photos/') > 0) {
    event.respondWith(cacheFirst(request));
  }
});
