# Voidv5 launcher bundle

A self-contained proxy launcher served from GitHub via jsdelivr.

## Entry points

- `logo.svg` — SVG wrapper with a foreignObject-embedded XHTML app. Open this
  file directly in a browser and it bootstraps the launcher as if it were a
  normal HTML page. Intended for jsdelivr delivery:

  ```
  https://cdn.jsdelivr.net/gh/<owner>/<repo>@<ref>/logo.svg
  ```

- `index.html` — plain HTML entry with the same UI. Functionally equivalent.

## How it works

1. The entry loads `assets/launcher.js` and `assets/launcher.css`.
2. The launcher imports BareMux (`runtime/baremux/index.mjs`) and starts an
   Epoxy transport pointed at the wisp backend (see `WISP_URL` in the build
   script). This is the only outbound connection that leaves the CDN origin.
3. It loads Scramjet (`runtime/scramjet/scramjet.all.js`) and initializes a
   controller with prefix `<scope>/scrammy/`.
4. It registers `sw.js` with scope equal to the directory that `logo.svg`
   lives in — at jsdelivr that is `/gh/<owner>/<repo>@<ref>/`.
5. The service worker intercepts any request under `<scope>/uv/*`,
   `<scope>/scrammy/*`, or `<scope>/bare/*` and forwards it through BareMux
   to the wisp backend.
6. On init, the launcher auto-navigates the full-viewport iframe to
   `HOMEPAGE` (encoded through Scramjet), so opening `logo.svg` is
   visually indistinguishable from opening the live site. All navigation
   thereafter stays on the CDN origin.
7. A URL hash like `logo.svg#/view.html` lands on `https://vng.lol/view.html`
   instead of the default homepage; `logo.svg#https://example.com` works too.

## Layout

```
logo.svg
index.html
sw.js
assets/
  launcher.js
  launcher.css
runtime/
  baremux/{index.mjs, worker.js}
  epoxy/index.mjs
  scramjet/{scramjet.all.js, scramjet.sync.js, scramjet.wasm.wasm}
  uv/{uv.bundle.js, uv.client.js, uv.handler.js, uv.sw.js, uv.config.js}
```

## Rebuilding

```sh
node svg-bundle/build.cjs /path/to/this/repo
```

(runs from the Voidv5 server repo, pulls fresh bundles from its
`node_modules` + `static/scramjet` and writes them here.)
