# Dependency modernization plan

Prepared 2026-09-26 for `feat/modernize`, starting at `3db726e` (currently the same
commit as `feat/containerize`). Stage 1's baseline and validation pipeline are
implemented; see [the testing guide](testing.md) for commands, rollback identity,
coverage, and recorded limitations. Application dependency upgrades in stages
2–6 have not been applied yet.

## Objective and scope

Bring the application, build system, container, and shared browser libraries to
current stable versions while preserving the site's appearance, interactions,
routes, shortlinks, API responses, and ability to display the archived doodles.
The agreed browser target is current desktop browsers and mobile Safari/Chrome.

Treat the application and artwork as separate dependency boundaries. Upgrade
the shell in this repository. Preserve the already built artwork and its bundled
libraries in `codedoodl.es-doodles`, including the recent gzip fixes. Updating
each doodle's Three.js, p5.js, shaders, or other embedded libraries is a separate
restoration project requiring artwork-by-artwork verification. The shell loads
the artwork in iframes; its vendor upgrades do not require rebuilding those files.

Keep the existing Express/Backbone architecture. There is no need for a framework
replacement to achieve the dependency upgrades. Preserve the source of retired
administration tools, but separate their dependencies from normal build/runtime
installation. Restoring the former AWS publishing service is outside the site
compatibility target.

## Findings before stage 1

- `.nvmrc` and the Dockerfile select Node **10.16.0**. The Dockerfile builds
  Python **2.7.18** to support the old native build chain, uses Debian Bullseye,
  installs with `npm install`, and prunes afterward.
- The lockfile is version 1. `package.json` declares 19 runtime and 42 development
  dependencies, with `coffee-script` and `request` duplicated between groups.
  There are no test/build scripts in npm beyond `start`; Docker invokes Gulp.
- Major locked versions include Gulp **3.9.1**, Browserify **6.0.3**, Node Sass
  **4.12.0**, Express **4.5.0**, EJS **2.5.5**, and Request **2.88.0**.
- Checked-in browser libraries include jQuery **2.1.0**, Underscore **1.7.0**,
  Backbone **1.1.2**, Backbone DeepModel **0.11.0**, Modernizr **2.6.2**, iScroll
  **5.1.3**, and TweenLite **1.16.1**. Updating npm alone does not update these.
- Gulp eagerly loads every task, including old deployment tasks. These imports
  keep AWS/S3 dependencies in the normal build even though the server's deployment
  hook has an unconditional disabled response before its deployment code.
- `dataMin` does not return its stream. The shared build error handler emits
  `end`, potentially hiding compilation failures. Asset revisioning assumes
  eight-character hashes and rereads files that have already been gzipped.
- JS, CSS, and data outputs contain gzip bytes without a `.gz` suffix. The server
  sets encoding based on extensions; image processing separately emits ordinary
  images, including SVG. Encoding must be verified from actual output bytes,
  including static errors and SVG responses, rather than assumed from a suffix.
- A lockfile-only npm audit reported **195 findings**: 25 critical, 116 high,
  47 moderate, and 7 low. With development dependencies omitted, it reported
  **57**: 10 critical, 33 high, 10 moderate, and 4 low. These are dependency-tree
  findings, not proof of reachable exploits. They exclude vendored browser code
  and artwork libraries.
- The live home page displayed **77 cards**, and the APIs returned **77 doodles**
  and **39 contributors**. The initial home-page console check reported no
  warnings/errors. `/health` returned `200` with `OK`.
- Both local and hosted master manifests list **78 doodles**. The missing entry,
  `samsy/fury-ribbons`, has no manifest in the assets checkout and its hosted
  manifest returns 404. Record this existing content defect separately; do not
  silently remove its manifest entry or count it as a new upgrade regression.
- CI runs on pushes to `master` and `feat/containerize`, and PRs targeting
  `master`. A push to `feat/modernize` currently receives no automatic build.
  Manual workflow dispatch uses the non-PR publish condition and can publish
  `latest`, so branch validation and release promotion need separate conditions.

These observations describe the original planning baseline. Stage 1 adds npm
test commands, feature-branch CI, a rebuildable legacy container, and checks of
all available archive entrypoints plus representative browser rendering. A full
artwork-by-artwork browser review remains a later release check.

## Dependency destinations

Versions below were checked against the npm registry on 2026-09-26. Recheck
patch releases when implementing and lock the versions actually tested.

| Component | Current | Proposed destination and treatment |
| --- | --- | --- |
| Node / container | 10.16.0 / Bullseye | Node 24 LTS on a supported official Debian-based Node image; pin the chosen patch and image digest. Align `.nvmrc`, `engines`, npm, CI, and Docker. |
| Gulp | 3.9.1 | 5.0.1; explicit `series`/`parallel` task graph and explicit task imports. |
| Sass | node-sass 4.12.0 / gulp-sass 4.0.2 | Dart Sass 1.105.0 / gulp-sass 6.0.1, using its modern API. |
| Browser bundling | browserify 6.0.3 / watchify 3.11.1 | browserify 17.0.1 / watchify 4.0.0; retain CommonJS application bundling. |
| CoffeeScript | coffee-script 1.7/1.8 | First consolidate on `coffeescript` 1.12.7 with coffeeify 3.0.1, then migrate to coffeescript 2.7.0 in its own stage. coffeeify 3 accepts both compiler versions. |
| Express | 4.5.0 | Current Express 4 as a temporary compatibility checkpoint, then Express 5.2.1. |
| Templates | ejs 2.5.5 | EJS 6.0.1; validate each template and Express engine integration independently. |
| HTTP client | request 2.88.0 | Node's built-in `fetch`, with explicit timeouts, HTTP-status checks, JSON-error handling, and cache/fallback behavior. |
| Middleware | old body-parser/cookies/session/compression/CORS | Express's JSON/form parsers; express-session 1.19.0, compression 1.8.2, cors 2.8.6. Remove cookie-parser if only used to support sessions; otherwise update to 1.4.7. |
| Shared utilities | underscore 1.7.0 / hashids 1.2.2 | underscore 1.13.8 in server and browser; hashids 2.3.0 only after all existing shortlinks round-trip unchanged. |
| Logging | winston 0.7.3 / colors 1.3.3 | Winston 3.19.0 with explicit console transport; remove coloring if it adds no useful behavior to container logs. |
| Browser DOM/MVC | jQuery 2.1.0 / Backbone 1.1.2 | jQuery 3.7.1 as a migration checkpoint, then full jQuery 4.0.0; Backbone 1.6.1. |
| Animation | TweenLite/CSSPlugin/EasePack 1.x | GSAP 3.15.0 with explicit API/easing migration and animation checks. |
| Deep models | Backbone DeepModel 0.11.0 | No newer npm release was found. Test against current Backbone/Underscore; retain with an explicit exception or replace the small used API with tested local code. |
| Feature detection | Modernizr 2.6.2 | A minimal Modernizr 3.13.1 build initially; update `touch` detection callers and CSS classes. Remove unneeded detectors/polyfills against the agreed browser matrix. |
| Scrolling | iScroll 5.1.3 | Prefer native scrolling with explicit preservation of scroll restoration, grid effects, credits, and info-panel behavior. iScroll 5.2.0 is deprecated, so it is only a temporary compatibility bridge. |
| Script loading | vendored `$script` | Audit callers; replace required behavior with a small native script-loading helper or use scriptjs 2.5.9 as a documented temporary dependency. |

Node 24 is the current LTS line; Node 26 is still Current. Choose LTS for
production and revisit Node 26 once it reaches LTS and the tests pass.
[Node release schedule](https://nodejs.org/en/about/previous-releases).

Node Sass is end-of-life, so updating that package to its last release is not a
useful destination. [Sass announcement](https://sass-lang.com/blog/node-sass-is-end-of-life/).

## Implementation stages

Each stage should be a separately reviewable change on `feat/modernize`, with a
working container checkpoint before starting the next behavior-changing stage.

### 1. Establish a repeatable baseline and validation pipeline

Record the current application commit, assets commit `9f42ed5`, deployed image
digest, environment-variable names, and proxy/asset-host behavior. Preserve a
usable old image for rollback; do not rely solely on a mutable `latest` tag.

Add test commands and fixtures before upgrading. Use HTTP contract tests for
server behavior and Playwright for user-visible behavior. Serve a pinned local
assets checkout using its real gzip/header convention so CI does not depend on
the public deployment. Use a small fixture asset server for cache/network error
tests. Capture baseline shell screenshots at desktop and mobile widths and
record known doodle failures separately.

Enable build/test CI for `feat/modernize` and relevant PRs. Keep tests ahead of
publishing, and make feature-branch builds unable to overwrite production tags.
Do not run legacy deployment Gulp tasks during verification.

**Gate:** reproducible baseline container and tests that can detect broken
routes, missing data, invalid encoding, missing fonts, and failed iframe loads.

### 2. Modernize the build and Node together

First separate build/runtime tasks from retired deployment tasks. Replace
recursive task autoloading with explicit imports. Remove unused imports and
dependencies only after checking their callers. Retain useful local authoring
commands; quarantine former AWS publishing commands from normal installation.

Use `coffeescript` 1.12.7 as the temporary compiler bridge, update all registration
paths, and use coffeeify 3.0.1. This allows the build migration to be checked
before changing CoffeeScript class semantics.

Migrate Gulp directly to 5 using `series`/`parallel`, returning every stream or
promise and allowing production builds to fail on compilation errors. Configure
watch mode separately. Modern plugins using ESM can live in a dedicated
`gulpfile.mjs` and ESM build modules; keep the application CommonJS during this
stage rather than changing the whole package's module type.

Preserve this build dependency order: clean generated outputs; build JS/vendor,
CSS, images/fonts, and data; revision assets; render HTML paths. Run shared
prerequisites once. Prefer clean regeneration over the current unrev/rev cycle,
and derive filenames from the generated manifest rather than eight-character
regex assumptions. Explicitly preserve vendor execution order.

Gulp 5 defaults stream encoding to UTF-8 and changes glob ordering. Use
`encoding: false` for binary/precompressed input and output paths where
appropriate, including revisioning and image/font copies, and test byte
integrity. [Gulp 5 release notes](https://github.com/gulpjs/gulp/releases/tag/v5.0.0),
[Gulp src options](https://gulpjs.com/docs/en/api/src/).

Replace Node Sass with Dart Sass; migrate slash division and global/import
syntax as needed. Keep CSS selector/layout behavior stable. Use a documented
Browserslist matching current desktop/mobile targets. Copy all font formats in
the build so the Docker font-copy workaround can be removed after validation.

Reduce the plugin chain instead of replacing every wrapper with another wrapper:

- Replace `run-sequence` and `gulp-util` with task composition, explicit
  conditionals, and ordinary logging. Remove notification-only CI dependencies.
- Replace old Uglify/debug stripping with a current JS minifier such as Terser;
  preserve error-reporting behavior and avoid blanket removal of useful errors.
- Use Dart Sass compressed output and current Autoprefixer/PostCSS instead of
  `gulp-minify-css`. Upgrade retained wrappers to compatible current releases.
- Remove the unused HTML/inline minifiers; their transforms are already disabled.
  Preserve EJS delimiters and the XML template contents.
- Replace old rimraf/filter/rename cleanup machinery with targeted Node filesystem
  operations when regenerating outputs. `fs`, `crypto`, and `zlib` can also
  handle straightforward hashing and gzip without old plugin dependencies.
- Preserve existing images; make optimization optional if its native binaries
  add build fragility. Retain source-image quality and metadata needed by the site.
- Update retained vinyl adapters, development reloading, and helper packages;
  choose one working reload path and verify edits actually rebuild.

Move to the official Node 24 image, remove NVM/Pyenv/Python 2 setup and obsolete
`unsafe-perm`, regenerate the lockfile intentionally with the chosen npm version,
and use `npm ci`. Install build dependencies only in the builder; create the
runtime dependency tree with `npm ci --omit=dev` in a separate stage. Include
TLS CA certificates and preserve the current environment-variable interface.

**Gate:** clean Node 24 build and watch mode work; a production-only install
boots; repeated clean builds have correct manifest references and gzip bytes;
the baseline HTTP/browser suite passes with the original UI libraries.

### 3. Modernize server dependencies and data loading

Upgrade server dependencies in small groups, with Express 5 last after removing
old Express calls. Specific changes in this source include:

- Replace `bodyParser()` in both site and hook setup with explicit parsers and
  preserve login form behavior. Configure current session options deliberately.
- Replace `res.send 200` with an explicit status response that preserves `OK`.
  Replace `res.sendfile` with `sendFile` and an explicit safe root/absolute path.
- Replace the old optional-parameter and wildcard routes (`/:path(*)`, `*`,
  `/holding/*`, and the optional doodle segments). Prefer explicit shortlink and
  incomplete-doodle routes, followed by static middleware and a final 404.
  Preserve route ordering, redirect statuses, and root-path matching.
- Validate EJS's current exports/renderFile contract and all rendered page types,
  escaping, inline configuration, and metadata. Change source templates in
  `project/html`, then regenerate the corresponding `app/site` outputs.
- Replace Request with `fetch`. Fetch handles encoded response bodies; do not
  manually decompress them again. Check `response.ok`, apply an abort timeout,
  handle malformed JSON, and bound concurrent manifest requests. Preserve
  manifest selection, newest-first ordering, contributor deduplication, and
  fallback semantics. Preserve exact shortlink IDs and Hashids settings.
- Make cache startup/refresh explicit: avoid exposing an uninitialized cache,
  coalesce refreshes, and retain the last successful data on upstream failure.
  Test empty manifests and missing individual manifests. The current timer is
  updated before the request finishes, and the cache begins as null.
- Fix the production process lifecycle: it currently uses `cluster.isMaster`,
  `worker.pid`, and a `death` listener. Prefer one process per container with
  container restart supervision; if multiple workers are retained, update the
  API and test worker replacement, shutdown, per-worker caching, and session
  behavior explicitly.

Express 5 changes route grammar and removes old response methods; this is a
code migration, not just a manifest edit.
[Express migration guide](https://expressjs.com/en/guide/migrating-5/).

**Gate:** the route/API/shortlink and auth suites pass in development and
production modes; upstream timeouts, 404s, malformed JSON, refresh, and container
termination have predictable behavior.

### 4. Migrate CoffeeScript to 2.7

Do this separately from Backbone and jQuery upgrades. The source contains bare
`super`, assignments to `@` before `super()`, constructors returning `null`, and
`Backbone.DeepModel.apply(this, arguments)`. CoffeeScript 2 emits native classes,
so these patterns need deliberate changes.

Move necessary view/model setup into appropriate Backbone initialization hooks,
preserving when `templateVars`, attributes, and listeners become available.
Simply moving `super()` to the first line is insufficient: Backbone constructors
call `initialize`, which invokes application methods. Check bound methods used
during superclass construction and explicit argument forwarding as well.
[CoffeeScript breaking changes](https://coffeescript.org/#breaking-changes).

After parity is established, compile server/config CoffeeScript during the
image build and start the generated JavaScript with Node. Preserve the relative
directory layout needed for locales, templates, public assets, and manifests.
This moves the compiler to build dependencies and removes runtime transpilation.

**Gate:** every CoffeeScript file compiles; model/view construction and teardown,
events, routing, templating, and startup pass in the compiled production image.
If a compiler blocker remains, document it and retain the 1.12.7 checkpoint
temporarily; do not present that intermediate state as completed modernization.

### 5. Upgrade browser libraries one group at a time

Move distributable libraries from manually copied vendor files to pinned npm
inputs, preserving licenses, globals, and load order. Keep custom `plugins.js`
behavior under application ownership and audit its legacy polyfills separately.

Upgrade Underscore, then Backbone plus DeepModel compatibility, then jQuery.
Use the appropriate jQuery Migrate generation for each major transition, fix
warnings, and remove Migrate from the finished production bundle. The project
uses `$.trim` in `project/coffee/data/Templates.coffee`, which jQuery 4 removes.
Use the full jQuery build because the application uses Ajax/Deferreds.
[jQuery 4 changes](https://blog.jquery.com/2026/01/17/jquery-4-0-0/),
[jQuery Migrate instructions](https://github.com/jquery/jquery-migrate/blob/main/README.md).

Upgrade animation separately. Translate TweenLite calls and easing constants to
GSAP 3, then compare the preload sequence, scrambled text, grid entry/exit,
navigation transitions, modal timing, and interruption/cancellation behavior.
[GSAP migration guide](https://gsap.com/resources/3-migration/).

Finally update feature detection and replace iScroll. Native scrolling is a
behavior change requiring specific tests: the grid consumes iScroll probe
events, restores offsets, animates back to top, and reveals footer credits.
Preserve these effects and the info panel's scrolling before removing iScroll.
Check touch/trackpad/mouse behavior and device rotation on real mobile browsers.

**Gate:** the same UI flows and intended visual results pass at each library
checkpoint. Record any remaining frozen dependency with its rationale, owner,
tests, and a concrete replacement task.

### 6. Finish dependency reduction and release validation

Remove dependencies with no remaining active consumers. For retained local
tools, replace `mkdirp`, `rimraf`, and `wrench` with Node filesystem APIs. Use a
temporary-directory API for clone workspaces rather than replacing UUID v1
blindly; remove `node-uuid` when it is no longer needed. Update `adm-zip` to
0.6.1 only if ZIP handling remains active. Update retained CLI libraries such
as `yargs`, `slug`, `figlet`, and URL validation with their API/module changes.

Keep retired AWS/S3 tools outside the default install graph. If AWS publishing
must become a supported feature again, migrate `aws-sdk` v2 and `s3` to the AWS
SDK v3 clients in a separate change with mocked/dry-run validation. Installing
the final AWS SDK v2 release would not solve its end-of-support status.

Run the full suite against the actual candidate image and pinned assets. Audit
runtime and build dependencies separately and inspect the final image as well
as npm packages. Resolve high/critical findings in active dependencies, or
document a specific justified exception; do not use `npm audit fix --force` as
the migration strategy. Add dependency-update automation after these gates work.

Refresh documentation for setup, environment variables, commands, asset hosting,
supported browsers, and the supported/retired administration tools. Keep action
SHA pins and review action updates separately; the existing workflow already
uses recent action major versions.

Publish an immutable candidate tag to the existing registries only after checks
pass. Validate it in the self-hosted environment, promote that tested image to
the production tag, and retain the prior image digest for rollback. Keep asset
changes separate so image rollback remains sufficient for this migration.

## Required regression coverage

| Area | Acceptance checks |
| --- | --- |
| Routes and metadata | Home, about, contribute, login/holding, valid and incomplete doodle paths, refresh/deep links, redirects, unknown routes, and `/health`; preserve status codes and rendered metadata. |
| IDs and API | Compare ordered doodle IDs/slugs, metadata fields, contributors, CORS, every available shortlink, malformed shortlinks, and manifest selection. The missing Fury Ribbons entry is an explicit baseline exception. |
| Data lifecycle | Cold start, concurrent requests, successful refresh, last-good cache, remote timeout/non-200/invalid JSON, local fallback, and empty manifests. |
| Asset transport | Verify raw bytes and decoded bodies, MIME types, Content-Encoding, Accept-Encoding behavior, cache headers, fonts, CSS, JS, XML, JSON, SVG, and missing static assets. Detect double compression and falsely gzip-labelled error pages. |
| Site UI | Grid thumbnails/video previews, scroll restoration, filtering if exposed, next/previous/random/reload, info overlays, source/download links, share-link construction, browser back/forward, resize, orientation, and mobile fallback. |
| Artwork | Load every available doodle through the shell, collect failed requests and frame errors, and check rendering/interaction with representative Canvas, WebGL, keyboard, mouse, touch, texture/font, and media examples. |
| Visual behavior | Compare the stable shell and representative animations. Doodles are animated/randomized, so exact whole-page pixel equality is not a universal acceptance criterion; use controlled captures and visual review where needed. |
| Browsers | Automated Chromium, Firefox, and WebKit checks; real mobile Safari/Chrome checks for WebGL, gestures, viewport/orientation, and media behavior that emulation cannot establish. |
| Build and runtime | Clean install/build twice, watch rebuild, production-only runtime install, explicit production environment, startup/readiness, graceful termination/restart, image contents, and both existing registry publishing destinations. |

Check external legacy integrations against the baseline. Site-side share/source
links should remain correct, but dependency updates cannot restore services that
have been retired externally. Do not mistake a successful HTTP response or
iframe `load` event for proof that a doodle renders correctly.

## Completion criteria

- All stages have passing, recorded compatibility checks against the candidate
  container and the agreed browsers, with existing defects clearly separated.
- Node 10, Python 2, Node Sass, Gulp 3, Request, and deprecated active build
  helpers are removed from the normal build/runtime path.
- Current stable releases are used for retained dependencies wherever the
  compatibility gates pass; exceptions are specific and documented.
- The visual identity, artwork, URLs/IDs, API contract, archive gzip convention,
  and self-hosted configuration continue to work.
- CI can validate feature branches without changing production, and a tested
  immutable image can be promoted or rolled back.
