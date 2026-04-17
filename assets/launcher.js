// Launcher — sets up baremux + epoxy transport, loads scramjet,
// registers the SW, and auto-navigates the iframe to HOMEPAGE so the
// page behaves as a direct mirror of the Void Network homepage.
(async function () {
  const BASE = location.pathname.replace(/\/[^/]*$/, '');
  const WISP = "wss://vng.lol/~r/9/";
  const HOMEPAGE = "https://vng.lol/";

  const $ = (sel) => document.querySelector(sel);
  const splash = $('#splash');
  const err    = $('#err');
  const frame  = $('#frame');

  function showErr(msg) {
    if (!err) return;
    err.textContent = msg;
    err.style.display = 'block';
    clearTimeout(showErr._t);
    showErr._t = setTimeout(() => { err.style.display = 'none'; }, 5000);
  }

  function normalize(s) {
    s = (s || '').trim();
    if (!s) return null;
    if (/^https?:\/\//i.test(s)) return s;
    if (/^[a-z0-9\-]+(\.[a-z]{2,})+(\/.*)?$/i.test(s)) return 'https://' + s;
    return null;
  }

  let scramjetController = null;
  let swReady = false;

  async function init() {
    const { BareMuxConnection } = await import(BASE + '/runtime/baremux/index.mjs');
    const conn = new BareMuxConnection(BASE + '/runtime/baremux/worker.js');
    try {
      await conn.setTransport(BASE + '/runtime/epoxy/index.mjs', [{ wisp: WISP }]);
    } catch (e) {
      showErr('Transport setup failed: ' + (e && e.message || e));
      throw e;
    }

    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = BASE + '/runtime/scramjet/scramjet.all.js';
      s.onload = resolve;
      s.onerror = () => reject(new Error('Failed to load scramjet'));
      document.head.appendChild(s);
    });

    const controllerMod = window.$scramjetLoadController();
    scramjetController = new controllerMod.ScramjetController({
      prefix: BASE + '/scrammy/',
      files: {
        wasm: BASE + '/runtime/scramjet/scramjet.wasm.wasm',
        all:  BASE + '/runtime/scramjet/scramjet.all.js',
        sync: BASE + '/runtime/scramjet/scramjet.sync.js'
      },
      flags: {
        serviceworkers: false, syncxhr: false, strictRewrites: false,
        rewriterLogs: false, captureErrors: false, cleanErrors: false,
        scramitize: false, sourcemaps: false, destructureRewrites: false,
        interceptDownloads: false, allowInvalidJs: true
      }
    });
    await scramjetController.init();

    const reg = await navigator.serviceWorker.register(BASE + '/sw.js', { scope: BASE + '/' });
    if (reg.installing) {
      await new Promise((resolve, reject) => {
        reg.installing.addEventListener('statechange', (e) => {
          if (e.target.state === 'activated') resolve();
          else if (e.target.state === 'redundant') reject(new Error('SW became redundant'));
        });
      });
    }
    if (!navigator.serviceWorker.controller) {
      await navigator.serviceWorker.ready;
      await new Promise(r => setTimeout(r, 100));
    }
    swReady = true;
  }

  function encodeScram(u) {
    if (scramjetController && typeof scramjetController.encodeUrl === 'function') {
      return scramjetController.encodeUrl(u);
    }
    return BASE + '/scrammy/' + encodeURIComponent(u);
  }

  function go(target) {
    if (!target) return;
    if (!swReady) { showErr('Proxy not ready yet'); return; }
    frame.src = encodeScram(target);
  }

  try {
    await init();
    if (splash) {
      splash.classList.add('done');
      setTimeout(() => { splash.style.display = 'none'; }, 400);
    }
    const h = (location.hash || '').replace(/^#/, '');
    if (h && h !== '/' && h !== '/home') {
      const override = h.charAt(0) === '/' ? 'https://vng.lol' + h : (normalize(h) || HOMEPAGE);
      go(override);
    } else {
      go(HOMEPAGE);
    }
  } catch (e) {
    if (splash) {
      splash.innerHTML = '<div style="text-align:center;color:#ffb4b4;padding:24px">' +
        '<p style="font-size:16px;margin:0 0 8px">Startup failed</p>' +
        '<p style="font-size:13px;opacity:.75;margin:0">' + (e && e.message || String(e)) + '</p></div>';
    }
  }
})();
