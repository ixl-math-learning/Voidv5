// Launcher — wires up baremux + epoxy transport, loads scramjet,
// registers the SW, and hooks up the URL bar.
(async function () {
  const BASE = location.pathname.replace(/\/[^/]*$/, '');
  const WISP = "wss://vng.lol/~r/9/";
  const HOMEPAGE = "https://vng.lol/";

  const $ = (sel) => document.querySelector(sel);
  const splash = $('#splash');
  const err    = $('#err');
  const bar    = $('#bar');
  const frame  = $('#frame');
  const urlIn  = $('#url');
  const goBtn  = $('#go');
  const engSel = $('#engine');
  const homeBtn = $('#home');

  function showErr(msg) {
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
    return 'https://www.google.com/search?q=' + encodeURIComponent(s);
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

  function encodeUV(u) {
    const enc = (window.Ultraviolet && window.Ultraviolet.codec && window.Ultraviolet.codec.xor)
      ? window.Ultraviolet.codec.xor.encode : (x) => x;
    return BASE + '/uv/' + enc(u);
  }
  function encodeScram(u) {
    if (scramjetController && typeof scramjetController.encodeUrl === 'function') {
      return scramjetController.encodeUrl(u);
    }
    return BASE + '/scrammy/' + encodeURIComponent(u);
  }

  function go(target) {
    const u = target || normalize(urlIn.value);
    if (!u) return;
    if (!swReady) { showErr('Proxy not ready yet'); return; }
    const proxied = engSel.value === 'uv' ? encodeUV(u) : encodeScram(u);
    frame.src = proxied;
  }

  goBtn.addEventListener('click', () => go());
  urlIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  homeBtn.addEventListener('click', () => go(HOMEPAGE));

  try {
    await init();
    splash.classList.add('done');
    setTimeout(() => { splash.style.display = 'none'; }, 400);
    urlIn.focus();
    const h = (location.hash || '').replace(/^#/, '');
    if (h && h !== '/' && h !== '/home') {
      const target = h.charAt(0) === '/' ? 'https://' + h.slice(1) : h;
      urlIn.value = target;
      go(target);
    }
  } catch (e) {
    splash.innerHTML = '<div style="text-align:center;color:#ffb4b4;padding:24px">' +
      '<p style="font-size:16px;margin:0 0 8px">Startup failed</p>' +
      '<p style="font-size:13px;opacity:.75;margin:0">' + (e && e.message || String(e)) + '</p></div>';
  }
})();
