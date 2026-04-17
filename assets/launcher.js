// Launcher — sets up baremux + epoxy transport, loads scramjet,
// registers the SW, and auto-navigates the iframe to HOMEPAGE so the
// page behaves as a direct mirror of the Void Network homepage.
(async function () {
  const BASE = location.pathname.replace(/\/[^/]*$/, '');
  const WISP = "wss://vng.lol/~r/9/";
  const HOMEPAGE = "https://vng.lol/";
  const DEBUG = true;

  const $ = (sel) => document.querySelector(sel);
  const splash = $('#splash');
  const frame  = $('#frame');
  let status = null;
  if (splash) {
    splash.innerHTML = '<div style="text-align:center;font-family:\'Google Sans\',Roboto,Arial,sans-serif;color:#3c4043;padding:24px;max-width:560px">' +
      '<div style="width:36px;height:36px;margin:0 auto 20px;border:3px solid #e8eaed;border-top-color:#1a73e8;border-radius:50%;animation:sp 1s linear infinite"></div>' +
      '<div id="st" style="font-size:14px;color:#5f6368;min-height:20px">Starting up\u2026</div>' +
      '<pre id="errbox" style="margin-top:20px;padding:12px;background:#fce8e6;color:#a50e0e;border-radius:6px;font-family:monospace;font-size:12px;text-align:left;white-space:pre-wrap;display:none;max-height:200px;overflow:auto"></pre>' +
      '</div>';
    status = splash.querySelector('#st');
  }
  const errbox = splash && splash.querySelector('#errbox');
  function setStatus(msg) { if (DEBUG) { try { console.log('[launcher]', msg); } catch(e){} } if (status) status.textContent = msg; }
  function showErr(e) {
    const msg = (e && e.stack) ? e.stack : (e && e.message) ? e.message : String(e);
    try { console.error('[launcher]', e); } catch(_) {}
    if (errbox) { errbox.textContent = msg; errbox.style.display = 'block'; }
    if (status) status.textContent = 'Startup failed — see details below';
  }

  let scramjetController = null;
  let swReady = false;

  async function init() {
    setStatus('Loading BareMux\u2026');
    const baremuxMod = await import(BASE + '/runtime/baremux/index.mjs');
    const BareMuxConnection = baremuxMod.BareMuxConnection;
    const conn = new BareMuxConnection(BASE + '/runtime/baremux/worker.js');

    setStatus('Setting up wisp transport\u2026');
    await Promise.race([
      conn.setTransport(BASE + '/runtime/epoxy/index.mjs', [{ wisp: WISP }]),
      new Promise((_, rej) => setTimeout(() => rej(new Error('Transport setup timeout (10s)')), 10000))
    ]);

    setStatus('Loading Scramjet bundle\u2026');
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = BASE + '/runtime/scramjet/scramjet.all.js';
      s.onload = resolve;
      s.onerror = () => reject(new Error('Failed to load scramjet.all.js'));
      document.head.appendChild(s);
    });
    if (typeof window.$scramjetLoadController !== 'function') {
      throw new Error('Scramjet loader not available — bundle may not have run');
    }

    setStatus('Initializing Scramjet controller\u2026');
    const { ScramjetController } = window.$scramjetLoadController();
    scramjetController = new ScramjetController({
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
    try { window.scramjet = scramjetController; } catch(_) {}

    setStatus('Registering service worker\u2026');
    if (!navigator.serviceWorker) throw new Error('Service workers not supported in this context (file:// or private mode?)');
    const reg = await navigator.serviceWorker.register(BASE + '/sw.js', { scope: BASE + '/' });
    if (reg.installing) {
      await Promise.race([
        new Promise((resolve, reject) => {
          reg.installing.addEventListener('statechange', (e) => {
            if (e.target.state === 'activated') resolve();
            else if (e.target.state === 'redundant') reject(new Error('SW became redundant during install'));
          });
        }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('SW activation timeout (10s)')), 10000))
      ]);
    }
    if (!navigator.serviceWorker.controller) {
      setStatus('Waiting for SW to claim page\u2026');
      await navigator.serviceWorker.ready;
      await new Promise(r => setTimeout(r, 150));
    }
    swReady = true;
    setStatus('Loading homepage\u2026');
  }

  function encodeScram(u) {
    if (scramjetController && typeof scramjetController.encodeUrl === 'function') {
      return scramjetController.encodeUrl(u);
    }
    return BASE + '/scrammy/' + encodeURIComponent(u);
  }

  function go(target) {
    if (!target || !frame) return;
    if (!swReady) { showErr(new Error('Proxy not ready yet')); return; }
    const proxied = encodeScram(target);
    if (DEBUG) { try { console.log('[launcher] iframe ->', proxied); } catch(_){} }
    frame.src = proxied;
  }

  if (frame) {
    frame.addEventListener('load', () => {
      if (splash) { splash.classList.add('done'); setTimeout(() => { splash.style.display = 'none'; }, 400); }
    });
  }

  try {
    await init();
    const h = (location.hash || '').replace(/^#/, '');
    let target = HOMEPAGE;
    if (h && h !== '/' && h !== '/home') {
      if (h.charAt(0) === '/') target = 'https://vng.lol' + h;
      else if (/^https?:/i.test(h)) target = h;
    }
    go(target);
  } catch (e) { showErr(e); }
})();
