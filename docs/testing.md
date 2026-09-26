# Modernization baseline

Stage 1 captured the Node 10 application as a regression reference. The current
suite validates the [Node 24 build](build.md) and [Express 5 server](server.md),
with additional build/watch, data-loading and process-lifecycle checks. The
Playwright package in `tests/` keeps its own lockfile and pinned
Playwright browser image, independent of the application's dependency tree.

## Stage 3 validation

Validated locally on Linux/amd64 on 2026-09-26 using `codedoodles:stage3`:
**35 passed, 5 device-specific skips, no expected or unexpected failures, and
no retries**. Chromium, Firefox, WebKit and both mobile projects retain the
unchanged stage 1 screenshot references. The existing route/API/auth contracts,
all 77 available shortlinks and archive inventory pass. A new transport contract
checks gzip/identity negotiation, HEAD, conditional 304 and rejection with 406.

All **23 native server tests** pass under Node 24.21.0 and Express 5.2.1, covering
manifest failures and stalled bodies, cold fallback, empty/missing manifests,
bounded concurrency, coalesced refresh, last-good retention, session parsing and
cookies, EJS escaping, original Hashids IDs, and lifecycle behavior. A Hashids 2
regression discovered by the browser suite is fixed: paths outside the shortlink
alphabet fall through to static serving or 404 instead of throwing. Native
coverage includes the Firefox icon request that exposed it.

The Docker builder passed the native server tests and all build/watch/development
checks. The actual runtime container exited with code 0 on SIGTERM, restarted
and became ready. It runs as UID 1000 with nine direct runtime dependencies;
Request, Colors, cookie-parser, build tools and AWS/S3 tooling are absent from
that dependency tree. The development server was restarted with stage 3 and
Shading Particles rendered WebGL frames from the local archive.

See [`tests/baselines/stage3-validation.json`](../tests/baselines/stage3-validation.json)
for the tested image identity and check record. The assets checkout is unchanged.
CoffeeScript 1.12.7 and the original browser libraries remain deliberate later
stages. Remote CI, publishing, deployment and real-device mobile checks were not
run; production TLS/proxy configuration remains a release check.

## Stage 2 validation (historical)

Validated locally on Linux/amd64 on 2026-09-26 using `codedoodles:stage2`:
**34 passed, 5 device-specific skips, no expected or unexpected failures, and
no retries**. All five browser projects passed their comparisons against the
unchanged stage 1 screenshots. The former SVG/static-404 encoding defects are
fixed, and login/holding CSS and fonts now have explicit coverage.

The Docker build passed byte-identical clean rebuilds, stale-output removal,
gzip/font/image integrity, JSON value preservation, manifest/EJS references,
compilation-error propagation, and watch rebuild/recovery checks. An additional
development check connected a real Chromium browser through BrowserSync and
confirmed an HTML edit caused a page reload. Local doodle creation and preview
also passed under Node 24.21.0.

The candidate runs as UID 1000 with Node 24.21.0, Express 4.22.3 and CoffeeScript
1.12.7. Its production-only dependency tree excludes Gulp, Sass, Browserify and
the former AWS/S3 build dependencies. System CA certificates are present.
The workflow passed actionlint. See
[`tests/baselines/stage2-validation.json`](../tests/baselines/stage2-validation.json)
for the exact local image identity and recorded checks. The assets checkout and
reference screenshots remain unchanged. Remote CI, registry publishing, real
mobile devices, and deployment have not been exercised in this stage.

Development follow-up checks also cover forwarded asset URLs and reload sockets,
plus local artwork serving (gzip HTML/JS, MIME types, media ranges and plain 404s).
Shading Particles submitted WebGL draw calls through a forwarded port while
external artwork requests were blocked by the test browser. These development
changes were checked locally after the recorded container run; the user also
confirmed the development site works with the local archive.

## Stage 1 validation (historical)

Validated locally on Linux/amd64 on 2026-09-26. The deployed reference image and
the rebuilt `codedoodles:stage1` image each completed all 39 cases: **32 passed,
2 expected failures, 5 device-specific skips, and no unexpected failures**.
Playwright groups the expected failures with passing checks in its summary.
The two failures are the existing SVG and static-404 gzip defects described below;
the skips cover the desktop-only intro and mobile-only fallback on other devices.

A negative-control image with one WOFF2 font removed was correctly rejected by
the font contract. The workflow passed actionlint, and the shell/JavaScript syntax
checks passed. Node and all 19 direct runtime dependency versions in the rebuilt
image match the deployed image. See
[`tests/baselines/validation.json`](../tests/baselines/validation.json) for image
identity and recorded results. GitHub Actions and registry publishing have not
been exercised remotely in this stage.

## Run the baseline

Requirements: Bash, Git, and Docker with Buildx and Compose. `npm test` is a
convenience wrapper; the equivalent `bash tests/run.sh` needs no host Node install.
Allow time for the first image build and browser-image pull. Docker builds also
run `npm run test:build` and `npm run test:server` under the pinned application
Node version. The latter can also be run directly after `npm ci && npm run build`.

The assets checkout must be clean and at
`9f42ed5c072a3f5b01e14d7b9859cf883edd9a2a`. The runner first looks in
`tests/archive`, then in the sibling `../codedoodl.es-doodles` checkout. To use
another checkout, set `DOODLES_ARCHIVE` to its absolute path. It checks the commit
and worktree before starting Docker. The assets repository is never modified.

```bash
# Run from the codedoodl.es repository. Builds and tests the current source.
npm test

# Test an image already built locally; no application rebuild.
CODEDOODLES_IMAGE=codedoodles:my-candidate bash tests/run.sh

# Run a subset during development.
CODEDOODLES_IMAGE=codedoodles:my-candidate bash tests/run.sh --project=contracts
CODEDOODLES_IMAGE=codedoodles:my-candidate bash tests/run.sh --project=chromium
```

For a new assets checkout, clone the repository into `tests/archive` and check
out the commit in `tests/assets.lock`. CI checks out that commit explicitly.
The suite has no dependency on the public deployment: after images are built,
containers run on a private network without internet access or exposed host ports.
Each invocation owns a uniquely named Compose project and removes its containers
and network on exit, including after a test failure. Images are retained.

Results are written to the ignored `tests/artifacts/` directory:

- `report/index.html`: Playwright report, including traces and failure screenshots.
- `results.json`: machine-readable results and known-defect annotations.
- `containers.log`: application, authentication, and fixture server logs.
- `image.json`, `application-commit.txt`, `assets-commit.txt`: tested image and
  source identities. The commit identifies the checkout; local edits are included
  when the runner builds the candidate. Use the image ID as the exact image identity.
- Build, container lifecycle and cleanup logs. CI uploads this directory even
  when tests fail.

## Reference and rollback

The frozen reference is application commit
`3db726eee1bd1d5c5e4982a3c34dea6761773b30` with the assets commit above.
`tests/baselines/reference.json` records the deployed image confirmed by the
operator's `docker inspect` output on 2026-09-26:

```text
forgejo.treyturner.info/treyturner/codedoodles@sha256:944e942f72c9fa0cce4ef8287eff3f89f2c04b1af3bb322ce884b59bcb039081
```

The same manifest is available from GHCR and has been pulled locally under
`codedoodles:rollback-3db726e`. On a fresh machine:

```bash
docker pull ghcr.io/treyturner/codedoodles@sha256:944e942f72c9fa0cce4ef8287eff3f89f2c04b1af3bb322ce884b59bcb039081
docker tag ghcr.io/treyturner/codedoodles@sha256:944e942f72c9fa0cce4ef8287eff3f89f2c04b1af3bb322ce884b59bcb039081 codedoodles:rollback-3db726e
```

To reproduce the original baseline run, use the stage 1 suite from commit
`6ac65a6` in a separate checkout. The current suite requires the encoding fixes
and holding-page stylesheet added in stage 2, so it intentionally rejects those
defects in the old image. The original screenshots remain the visual reference.

Keep the old image on the deployment host until a candidate has been accepted.
Rollback uses this immutable image reference with the existing container
configuration and unchanged asset archive. Local verification does not deploy or
retag the remote production image.

The old Dockerfile initially failed to rebuild because the live Bullseye
security index referenced package downloads returning 404. Stage 1 pinned its
Bullseye base and the 2026-09-01 Debian package snapshot so that historical build
could be rebuilt. Stage 2 replaces that chain with the official Node 24 image and
`npm ci`; Python 2, NVM and Pyenv are gone. See [build.md](build.md). The immutable
reference is a functional regression reference, not a claim that rebuilt Docker
images have identical metadata or OS package bytes.

## What is checked

HTTP contracts cover health, rendered pages/metadata, 404s and redirects, all 77
available shortlinks, the complete API payload and order, 39 contributors, CORS,
login/session behavior, revisioned assets, gzip byte integrity, and WOFF/WOFF2
fonts. The asset inventory checks every available doodle's manifest, HTML
entrypoint, and thumbnail. A few `.jpg` thumbnails contain PNG bytes; both valid
image signatures are accepted.

`tests/fixtures/api.json` freezes the data merged from the pinned archive's
production master and individual manifests. Its `fallbackDoodles` field uses
the application repository's local DEV master. That file equals the archive's
DEV master; some creation timestamps differ from the production master. Tests
exercise both manifest selections without normalizing those differences away.

The local asset server serves the existing gzip bytes under their original
filenames, with MIME types and range support for videos. It does not add CORS
or cache-control headers absent from the observed Apache asset host. Fixture
paths provide a missing master and a reset connection for one manifest. Separate
production app instances verify fallback, partial data, and repeated cached reads.
`invalid-json`, `empty`, and `timeout` fixture paths remain available for manual
container probes. Stage 3's native server tests use configurable local HTTP
fixtures to exercise these failures, stalled response bodies, last-good refresh,
coalesced requests and bounded concurrency without waiting for the production TTL.

Browser tests cover the home grid and font loading, the first-visit prompt,
client-side navigation/history, a Canvas doodle rendering changing frames,
its info/shortlink/reload controls, adjacent-doodle navigation, and the mobile
fallback. They run Chromium, Firefox, WebKit, mobile Chromium, and mobile WebKit.
The shared canvas test uses the self-contained Canvas 2D Neon Bubbles doodle;
Box Physics separately verifies WebGL draw calls and pointer interaction in
Chromium. Headless Firefox in this runner cannot create the WebGL context used
by OITNB, so that limitation is recorded rather than mistaken for a site regression.
Mobile projects emulate devices; real-device gestures, GPU behavior, and a full
visual review of every artwork remain later release checks.

Stage 3 runs a single process per container and removes the old `limit-cpus.cjs`
preload. After the browser suite, the runner stops the actual application
container with SIGTERM, requires exit code 0, starts it again and waits for
readiness. Native subprocess tests also cover startup failure/cancellation,
SIGINT and an active response draining during shutdown.

## Screenshots and known defects

`tests/baselines/<browser>/home.png` contains reviewed shell screenshots produced
from the immutable reference image. Browser versions, fonts, locale, timezone,
and viewport are fixed in the test runner. Small rasterization differences are
tolerated, while layout and font regressions fail. Animated doodles are checked
for rendering rather than compared to a single random animation frame.

Normal runs mount reference screenshots read-only and never update them. To
deliberately replace a baseline locally:

```bash
CODEDOODLES_IMAGE=codedoodles:rollback-3db726e npm run test:update-snapshots -- \
  --project=chromium --project=firefox --project=webkit \
  --project=mobile-chromium --project=mobile-webkit
```

Review the image changes before accepting them. Do not regenerate baselines to
make an unexplained upgrade failure pass. The wrapper rejects snapshot updates
in CI; CI compares the checked-in images.

Defects observed in the original image are recorded in
`tests/baselines/reference.json`:

- `MISSING-FURY-RIBBONS`: the master lists 78 entries, but
  `samsy/fury-ribbons` has no archived manifest/entrypoint. The expected API has 77.
- `ENCODING-SVG`: ordinary shell SVG bytes were incorrectly labelled gzip;
  fixed in stage 2.
- `ENCODING-404`: missing static JS returned HTML with an incorrect gzip header;
  fixed in stage 2.
- `MEDIA-PLAY-ABORT`: rapidly hovering a thumbnail can interrupt its pending
  video `play()` call. The exact observed cancellation is annotated; other
  browser errors and failed requests still fail tests.

The two encoding checks are now required to pass; stage 1's expected-failure
markers have been removed. Missing data cannot silently expand the exception list:
complete API comparisons and the archive inventory catch additional omissions.
The reference also records a content limitation discovered during selection of
offline rendering examples: Muscular Hydrostats loads sketch.js from an external
URL despite an archived local copy. Its entrypoint is inventoried, but it is not
one of the offline rendering examples. No archive source was rewritten to hide
external dependencies.

## Configuration and hosting boundary

The application still accepts `NODE_ENV`, `BIND_ADDRESS`, `BIND_PORT`, `BASE_URL`,
`DOODLES_URL`, `DOODLE_DATA_SOURCE`, `GOOGLE_ANALYTICS_CODE`, and `DEV_PASSWORD`.
These names are unchanged. Tests use production mode, explicit local base/asset
URLs, no analytics, and a fixed test-only password in the authentication fixture.
`DOODLE_DATA_SOURCE=production` chooses the production master; other values choose
the DEV master. The site hostname `site.test` avoids the real `.app` HSTS suffix.

The observed public deployment uses HTTPS at `doodles.treyturner.info` and a
separate Apache asset origin at `doodle.treyturner.info`. The asset host serves
gzip manifests and ordinary binary JPEGs without CORS headers. `/health` returns
`200 OK` and `Vary: Accept-Encoding`. The runner verifies the HTTP services inside
Docker; TLS termination and the production proxy configuration require a check
in the self-hosted environment before a future release.

## CI and publishing

The workflow validates pushes to `master`, `feat/containerize`, and
`feat/modernize`, plus PRs targeting those branches. It builds one candidate,
runs the container suite, uploads diagnostics, then publishes that same image
only when tests succeed and the ref is `master`.

Feature branches and PRs never publish. Manual runs default to validation only;
publishing must be selected explicitly and is still restricted to `master`.
This also ends automatic production publishing from `feat/containerize`.
Successful releases receive `sha-<commit>` and `latest` tags at both existing
registries, so later rollback does not depend on remembering an overwritten tag.
No AWS/S3/Elastic Beanstalk deployment tasks are invoked.
