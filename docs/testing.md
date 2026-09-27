# Modernization baseline

Stage 1 captured the Node 10 application as a regression reference. The current
suite validates the [Node 24 build](build.md) and [Express 5 server](server.md),
[compiled CoffeeScript 2 runtime](coffeescript.md), and [browser libraries and
native scrolling](browser.md), with additional build/watch, data-loading and
process-lifecycle checks. The
Playwright package in `tests/` keeps its own lockfile and pinned
Playwright browser image, independent of the application's dependency tree.

## Stage 6 validation (2026-09-27)

Stage 5, including the preview-video and responsive-warning regressions, is
committed as `89ca6c0`. Stage 6's local candidate is `codedoodles:stage6`; see
[`stage6-validation.json`](../tests/baselines/stage6-validation.json) for its
image/config identity, audit/test counts and execution qualifications.

The complete container suite was exercised in separate shell and artwork groups:
**158 unique cases pass and 9 platform-specific cases remain intentionally skipped**.
This includes the previous 81 HTTP/browser cases and **77 artwork comparisons**.
All five original shell screenshot references are unchanged. The candidate exits
0 on SIGTERM and becomes ready after restart. Docker builder checks pass, along
with 23 native server tests and eight local-tool/security/release tests.

All 77 sketches were also observed in the original Node 10 image. Both images
submitted Canvas/WebGL drawing commands for 74 sketches, with no loss of drawing,
new frame exceptions or new failed asset requests in the candidate. Go With the
Flow and Muscular Hydrostats depend on external scripts blocked by the private
network; the input sequence did not establish Codebrush rendering, which
remains a manual review item. Collapsar's existing width exception and missing Line audio are also
recorded. These are preserved observations, not claims that every artwork is
fully functional. Original records and collection caveats are in
[`artwork-reference.json`](../tests/baselines/artwork-reference.json).

Heavy Treee/Smashing Mega Scene screenshots initially exceeded the diagnostic
capture budget. Direct viewport-rectangle capture avoids waiting for animated
iframe layout to stabilize; local reruns passed with a 90-second artwork budget.
Hosted CI subsequently exceeded that total budget for Boobs, Smashing Mega Scene
and Treee while processing native input, screenshots or teardown. The artwork
project now allows 180 seconds overall and 45 seconds for readiness assertions,
and reuses the resolved iframe handle to avoid redundant selector waits behind
software WebGL frames. Observation delays run in the test runner instead of
queuing browser commands. Artwork traces retain actions and network events,
without automatic DOM snapshots or continuous screenshot capture competing for
graphics resources; explicit artwork and failure screenshots remain enabled.
Rendering assertions,
input, screenshots, the 1440×900 viewport and reviewed baselines are unchanged;
automatic retries remain disabled.
The local candidate gallery is at
[`tests/artifacts/artwork/index.html`](../tests/artifacts/artwork/index.html).
Raw reports and screenshots are ignored build artifacts, with compact validation
and baseline records tracked in Git.

Runtime and test npm audits have no findings. The build graph retains four low
findings from one Browserify/Elliptic advisory; the browser graph test verifies
those crypto shims are absent from the shipped bundle. The final image has no
critical or Node package findings. Its 43 high OS package findings map to eight
reviewed, version-scoped CVEs with no available Debian fix; exceptions expire
2026-11-01. See [security.md](security.md) for the counts, rationale and gates.

Weekly dependency checks and digest-preserving candidate promotion are prepared;
actionlint and local release-policy tests pass. Remote CI, registry publication,
actual host/proxy validation, real mobile Safari/Chrome review and production
promotion remain the [release steps](release.md). No registry or production
service was changed during this local delivery.

## Stage 5 validation

Validated locally on Linux/amd64 on 2026-09-27 using `codedoodles:stage5`:
**81 passed, 9 device-specific skips, no failures, and no retries**. All five
browser projects match the unchanged stage 1 screenshot references. The existing
route, API, session, archive, Canvas/WebGL and navigation contracts still pass.

The jQuery 3.7.1/Migrate 3.6.0 and jQuery 4.0.0/Migrate 4.0.2 checkpoints each
passed **45 checks with 5 skips**, without Migrate warnings or screenshot changes.
The final bundle removes Migrate and uses jQuery 4.0.0, Underscore 1.13.8,
Backbone 1.6.1 and GSAP 3.15.0. The local DeepModel compatibility fork remains
the [documented dependency exception](browser.md#frozen-dependency-exception-deepmodel).

New checks cover full Ajax/Deferreds, nested model behavior, native grid and info
scrolling, keyboard and touch input, scroll restoration and cancellation, resizing,
credits, preview playback and rapid hover changes, GSAP transitions and retained
modal primitives. Held info-button presses exercise delayed artwork focus and
moving header labels; pointer capture preserves stationary clicks while dragging
away still cancels them. Closing info restores artwork focus. The modal check uses
a fixture template because that retained primitive has no live template or route.

The mobile fallback check now clicks through to the video and requires decoded
video dimensions. Additional regressions cover protocol-relative local archive
links with and without a new-tab target, repeated resizing across 749/750 pixels,
warning persistence after delayed callbacks, refresh while in fallback, history
navigation, and unchanged running frames within one mode or for mobile-friendly
sketches. Both new regressions fail against the previous stage 5 image, confirming
they detect the reported routing and resize bugs. The actual development server
also passed video click-through and widening/narrowing checks with local artwork.

The full Docker build passed all **23 native server tests**, deterministic output,
license notices, gzip/font/image checks, invalid source rejection, watch recovery,
forwarded development URLs, local artwork delivery, and compiled-server restart
checks. The runtime has eight direct dependencies, starts generated JavaScript as
UID 1000, and excludes installed jQuery, Backbone, GSAP, build tools and the
CoffeeScript compiler; browser code is served from the compiled bundles.
Container SIGTERM exit 0 and restart readiness both passed.

See [`tests/baselines/stage5-validation.json`](../tests/baselines/stage5-validation.json)
for the exact image identities, checkpoint results and runtime record, and
[browser.md](browser.md) for the implementation and remaining dependency exception.
The development preview serves stage 5 with the local artwork archive. The assets
checkout and reference screenshots are unchanged. Real-device Safari/Chrome,
complete visual review of every artwork, production TLS/proxy validation, remote
CI, registry publishing and deployment remain release checks.

## Stage 4 validation (historical)

Validated locally on Linux/amd64 on 2026-09-26 using `codedoodles:stage4`:
**40 passed, 5 device-specific skips, no expected or unexpected failures, and
no retries**. All five browser projects match the unchanged stage 1 screenshot
references. Routes, APIs, all 77 available shortlinks, sessions, archive inventory,
Canvas/WebGL rendering, mobile fallback and navigation continue to pass.

All **65 CoffeeScript files** compile with 2.7.0, including modules outside the
browser entrypoint. All **23 native server tests** pass against the compiled
`dist` tree. The Docker builder passed deterministic compiled/asset rebuilds,
stale-module removal, invalid browser/server/configuration source rejection,
watch recovery, forwarded/local-artwork checks, and a running-server recompile
and restart after an edit. Watch readiness now waits for its initial filesystem
scan; the development checks also wait for the proxy to be ready.

New browser coverage verifies native model construction/options, both `set`
forms, nested change events, view reuse and stable callback identities, and
listener removal/reinstallation through repeated navigation in all five projects.
It caught and fixed a native-class strict-mode failure in the old key/value
`set` override. The server image has eight direct runtime dependencies, no
CoffeeScript compiler or `.coffee` source, and starts generated JavaScript as
UID 1000. Container SIGTERM exit 0 and restart readiness both passed.

An intermittent WebKit intro failure was reproduced on the stage 3 image with
a 200 ms mouse press: both diagnostic attempts lost the click before its handler
ran while animated text was replaced. Intro letters now ignore pointer events,
so the button remains the target. The normal first-visit test now includes that
held press and passes on all three desktop browser projects, without changing
the screenshot references or relaxing assertions.

See [`tests/baselines/stage4-validation.json`](../tests/baselines/stage4-validation.json)
for the exact tested image and check record. The dev server runs compiled code
and still serves local artwork; Neon Bubbles and Shading Particles were also
checked there. The archive and vendor libraries are unchanged. Browser-library
upgrades remain stage 5; real devices, production TLS/proxy validation, remote
CI, registry publishing and deployment remain release checks.

## Stage 3 validation (historical)

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

The workflow validates pushes to `master`, `feat/containerize`, `feat/modernize`,
and `ci/ubuntu-26.04`, plus PRs targeting those branches. Both validation and
promotion workflows select `ubuntu-26.04` explicitly so the runner OS transition
is tested before merging back into modernization. Container image pins remain
the same. Build, server, local-tool, three npm audit, runtime image scan, HTTP,
browser and artwork gates run before
candidate publication. Diagnostics are saved even on failure. Master pushes
publish a uniquely tagged candidate; manual dispatch can publish a feature
candidate when explicitly selected. Ordinary feature pushes and PRs do not publish.

A separate master-only promotion workflow verifies candidate digests at both
registries and copies the tested manifest to `latest` after host/device validation.
It never rebuilds. See [release.md](release.md) for the exact sequence and the
operator-confirmed original rollback digest. No retired AWS tasks are invoked.

## Full artwork observations

The `artwork` Chromium project visits all 77 available sketches through the shell
at a desktop viewport. It records frame exceptions and failed requests, observes
native Canvas/WebGL draw calls, sends pointer/click/key input, and saves a
screenshot and JSON observation per sketch in `tests/artifacts/artwork/`.
`artwork/index.html` provides a local gallery with the recorded diagnostics.
It rejects new errors/failed assets and loss of drawing against
`baselines/artwork.json`, recorded with the original stage 1 image and the same
pinned archive. Existing external-service/shader failures are visible in that
record, not silently treated as successful rendering. The dedicated representative
Canvas/WebGL tests continue to assert stronger animation/interaction behavior.

Run just that project with `bash tests/run.sh --project=artwork`. Tests normally
run it together with all shell/browser projects. `TEST_RESULTS_DIR` selects an
alternate artifact directory for independent runs. Original observations can be
collected locally with `ARTWORK_RECORD=1` and the original `CODEDOODLES_IMAGE`;
this is forbidden in CI, writes only artifacts, and does not update the reviewed
baseline automatically. Keep the source image ID and assets commit with any
reviewed baseline change. Do not bless candidate observations as original behavior.

Drawing commands and synthetic input do not establish visual/artistic correctness
or every interaction. Review the screenshots and exercise actual mobile Safari/
Chrome before promotion. Archive restoration remains separate from shell updates.
