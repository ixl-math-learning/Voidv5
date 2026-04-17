// Service worker: scope = the directory containing this file.
// Routes:
//   <scope>/uv/*       -> Ultraviolet
//   <scope>/scrammy/*  -> Scramjet
// Everything else passes through.
var B = self.location.pathname.replace(/\/[^/]*$/, '');
importScripts(
  B + '/runtime/uv/uv.bundle.js',
  B + '/runtime/uv/uv.config.js',
  B + '/runtime/uv/uv.sw.js',
  B + '/runtime/scramjet/scramjet.all.js'
);

var uv = new UVServiceWorker();
var scramjet = new ($scramjetLoadWorker().ScramjetServiceWorker)();

var cfgLoaded = false, cfgTried = false, cfgPromise = null;

self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(Promise.all([
    self.clients.claim(),
    self.registration.navigationPreload && self.registration.navigationPreload.enable()
  ]));
});

function errorPage() {
  return new Response(
    '<!doctype html><meta charset=utf-8><title>Loading</title>' +
    '<body style="background:#0a0a0a;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">' +
    '<div style="text-align:center"><p>Connecting...</p>' +
    '<script>setTimeout(function(){location.reload()},2500)</script></div>',
    { status: 200, headers: { 'Content-Type': 'text/html' } }
  );
}

async function handle(event) {
  try {
    if (uv.route(event)) {
      try { return await uv.fetch(event); }
      catch (e) {
        if (event.request.destination === 'document' || event.request.destination === 'iframe') return errorPage();
        return new Response('', { status: 502 });
      }
    }
  } catch (e) {}

  if (!cfgLoaded && !cfgTried) {
    if (!cfgPromise) {
      cfgPromise = Promise.race([
        scramjet.loadConfig(),
        new Promise(function (_, r) { setTimeout(function () { r(new Error('cfg timeout')); }, 5000); })
      ]).then(function () { cfgLoaded = true; cfgTried = true; })
        .catch(function () { cfgTried = true; });
    }
    await cfgPromise;
  }

  try {
    if (scramjet.route(event)) {
      try { return await scramjet.fetch(event); }
      catch (e) {
        if (event.request.destination === 'document' || event.request.destination === 'iframe') return errorPage();
        return new Response('', { status: 502 });
      }
    }
  } catch (e) {}

  return fetch(event.request).catch(function () { return new Response('Network error', { status: 502 }); });
}

self.addEventListener('fetch', function (event) {
  var url;
  try { url = new URL(event.request.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;
  var p = url.pathname;
  if (p.indexOf(B + '/uv/')      !== 0 &&
      p.indexOf(B + '/scrammy/') !== 0 &&
      p.indexOf(B + '/bare/')    !== 0) return;
  event.respondWith(handle(event).catch(function () { return new Response('SW error', { status: 502 }); }));
});
