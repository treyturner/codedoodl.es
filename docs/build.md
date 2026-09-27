# Building and developing the site

The build uses **Node 24.21.0 / npm 11.19.0**, **Gulp 5.0.1**, **Dart Sass 1.105.0**,
**Browserify 17.0.1**, and **CoffeeScript 2.7.0**.
The app is authored in CommonJS/CoffeeScript and runs compiled JavaScript. Its
shared browser libraries use pinned npm distributions; the sibling artwork
archive is unchanged. See [browser.md](browser.md).

## Commands

Use the Node version in `.nvmrc`; npm ships with that release. The same versions
are declared in `package.json` and supplied by the pinned official Node image.

```bash
nvm install
nvm use
npm ci
npm run build
npm start
```

For development, `npm run dev` builds, starts the application on port 3000, and
proxies it through BrowserSync on http://localhost:3002. Successful rebuilds
restart the compiled server, wait for readiness and reload connected browsers.
Asset URLs follow the browser's host and port, so
forwarded ports and LAN access work without additional URL configuration.
`BIND_PORT` and `DEV_PORT` override the listening ports; an explicit `BASE_URL`
overrides the public URL. `npm run watch` only rebuilds sources and is
useful with a separately managed server. Both watch modes watch browser/server
code, configuration and manifests, use the production build pipeline including
hashing and gzip, and recover on the next edit after a compilation error.

When the sibling `../codedoodl.es-doodles` checkout is present, the dev server
serves its artwork at `/__doodles` through the same browser origin. This avoids
external iframe requests during local development and works through a single
forwarded port. `DOODLES_ARCHIVE` selects another checkout. An explicit
`DOODLES_URL` selects a remote archive instead. Local artwork keeps its original
gzip bytes, MIME types and media range support; BrowserSync does not inject code
into it. The production container continues to use its configured asset host.

The server environment interface remains `NODE_ENV`, `BIND_ADDRESS`, `BIND_PORT`,
`BASE_URL`, `DOODLES_URL`, `DOODLE_DATA_SOURCE`, `GOOGLE_ANALYTICS_CODE`, and
`DEV_PASSWORD`. Point `DOODLES_URL` at a correctly configured archive host.
The container tests supply their own pinned, offline asset server. Development
mode retains the data loader's local-manifest selection. Stage 3 makes cache
initialization, refresh and network failures explicit; see [server.md](server.md).

## Build inputs and outputs

- `project/coffee` is compiled with CoffeeScript 2.7.0 through Coffeeify 3.0.1,
  bundled with Browserify and minified with Terser.
  Console/error reporting is retained.
- Browser distribution paths in `package.json` are concatenated in explicit
  order and minified with Terser. `project/browser` owns feature detection and
  animation defaults; `project/vendor` retains the documented DeepModel fork.
  License notices also ship at `/static/licenses/browser.txt`.
- `project/sass` uses Sass modules and modern arithmetic/built-ins. Sass's modern
  API and PostCSS/Autoprefixer replace Node Sass and the CSS plugin chain.
  Browserslist targets the last two Chrome, Firefox, Edge, Safari, iOS Safari,
  and Android Chrome versions recorded by the locked browser data.
- `project/fonts` supplies every original font format to the main and holding
  pages. `project/public` and `project/img` supply static files; image bytes are
  copied without native image optimizers.
- `project/data` supplies JSON and XML. JSON is parsed and serialized; template
  XML is preserved to avoid altering client template syntax or text. Unlike the
  old minifier, JSON serialization preserves spaces inside strings. The browser
  placeholder helper now accepts both spaced and unspaced names, preserving
  sponsor image URLs and other links interpolated from locale data.
- `project/html` supplies the EJS pages. Build placeholders must resolve through
  the newly written `rev-manifest.json`; missing entries fail the build.

`app/public`, the three generated `app/site/{index,holding,login}.html` pages,
`rev-manifest.json` and `dist/` are generated and ignored by Git. Do not edit them.
The build deletes its previous outputs, finishes all parallel asset tasks, then
gzips and hashes completed JS/CSS/XML/JSON once, and finally renders HTML paths.
Hashes are derived from output bytes; no fixed-length filename guessing or
in-place unrevision step remains. Login/holding CSS is generated explicitly so
those templates also have a valid manifest entry. Finally, it compiles server
and configuration modules into `dist/`, alongside templates, assets, locales and
local manifests. `npm start` runs `dist/app/start.cjs` without a compiler hook.
See [coffeescript.md](coffeescript.md) for construction/callback migration details.

Precompressed output retains ordinary filenames, matching the archive convention.
Static middleware inspects the actual file signature and negotiates gzip or
identity responses. Plain SVGs and missing-file HTML do not receive a false gzip
label. Holding assets remain available before login. See [server.md](server.md)
for conditional requests, cache headers and the unchanged archive boundary.

## Container and verification

```bash
docker build -t codedoodles:stage5 .
CODEDOODLES_IMAGE=codedoodles:stage5 bash tests/run.sh
```

The multi-stage Dockerfile pins the official Node 24 Bookworm image by digest,
includes system CA certificates, runs `npm ci`, builds, and exercises build
and server checks. A separate dependency stage runs `npm ci --omit=dev`; only its
runtime dependencies and compiled application enter the final image. CoffeeScript
and Coffeeify are absent from the runtime. The container runs
as the existing `node` user. Python 2, NVM, Pyenv, Node Sass, Gulp 3, and the
Docker font-copy workaround have been removed.

`npm run test:build` uses a disposable source copy to verify byte-identical clean
builds, stale-output removal, manifest/EJS references, gzip integrity, all font
formats, image preservation, failure propagation, and watch rebuild/recovery
for CoffeeScript dependencies, Sass, data and HTML. It also checks every
CoffeeScript module (including unreferenced ones), deterministic compiled output
and stale-module removal. It starts the development server to check asset URLs
and live-reload configuration behind a forwarded
port, and verifies server source edits compile and restart the running app.
It also runs during Docker builds, so the existing CI candidate build enforces
these checks under Node 24.
The HTTP/browser suite checks the resulting production-only image against the
original screenshot references; see [testing.md](testing.md).

## Remaining dependency checkpoints

CoffeeScript is now 2.7.0 and build-only. Stage 3 uses Express 5 and current
server libraries; Request and the old Winston dependency tree are gone.
Stage 5 updates the shared browser libraries and native scrolling; its sole
frozen browser dependency is documented in [browser.md](browser.md). Local
helper/dependency reduction and release validation remain stage 6. See [server.md](server.md) and
[coffeescript.md](coffeescript.md) for the current runtime behavior.

`npm run doodle:create` and `npm run doodle:preview -- doodles/author/name` retain
local authoring and preview tools. Figlet and Slug have been updated, and all
CoffeeScript registration paths use the renamed compiler package. Remaining
local helper reduction is stage 6. Retired AWS tasks and their historical
dependency declarations are preserved under [`legacy/`](../legacy/README.md),
outside normal installation and the active Gulp task graph.

Sources: [Gulp binary input behavior](https://gulpjs.com/docs/en/api/src/),
[Sass module migration](https://sass-lang.com/documentation/breaking-changes/import/),
[Node release support](https://nodejs.org/en/about/previous-releases).
