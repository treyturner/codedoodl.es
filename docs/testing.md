# Modernization baseline

Stage 1 adds container-based regression checks without upgrading the application's
Node 10 or npm dependencies. The test package in `tests/` has its own lockfile
and a pinned Playwright browser image. The main `package-lock.json` is unchanged.

## Stage 1 validation

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
Allow several minutes for the first legacy image build and browser-image pull.

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
- Build and cleanup logs. CI uploads this directory even when tests fail.

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
CODEDOODLES_IMAGE=codedoodles:rollback-3db726e bash tests/run.sh
```

Keep the old image on the deployment host until a candidate has been accepted.
Rollback uses this immutable image reference with the existing container
configuration and unchanged asset archive. Stage 1 does not deploy or retag the
remote production image.

The old Dockerfile initially failed to rebuild because the live Bullseye
security index referenced package downloads returning 404. The Dockerfile now
pins the existing Bullseye base and uses the 2026-09-01 Debian package snapshot.
Expired snapshot metadata is allowed for these fixed sources; package signatures
are still verified. Node 10.16.0 and Python 2.7.18 remain in place for the baseline.
Stage 2 replaces this historical build chain with a supported Node/OS combination.
The legacy NVM/Pyenv installers and `npm install` remain until that stage;
the baseline is a functional regression reference, not a claim of bit-for-bit
reproducible image builds.

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
`invalid-json`, `empty`, and `timeout` fixture paths are also available for the
data-loader repairs in stage 3; robust handling of those cases is not claimed yet.

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

The test-only `limit-cpus.cjs` preload limits `os.cpus()` to one CPU because
Node 10 ignores container CPU quotas when creating workers. This preserves the
real `npm start` / production cluster entrypoint while avoiding dozens of workers
and duplicate manifest downloads on a large build host. It is mounted read-only,
is not in the application image, and does not change the server or cache code.
Remove this adapter when the process model is modernized.

## Screenshots and known defects

`tests/baselines/<browser>/home.png` contains reviewed shell screenshots produced
from the immutable reference image. Browser versions, fonts, locale, timezone,
and viewport are fixed in the test runner. Small rasterization differences are
tolerated, while layout and font regressions fail. Animated doodles are checked
for rendering rather than compared to a single random animation frame.

Normal runs mount reference screenshots read-only and never update them. To
deliberately replace a baseline locally:

```bash
CODEDOODLES_IMAGE=codedoodles:rollback-3db726e npm run test:update-snapshots
```

Review the image changes before accepting them. Do not regenerate baselines to
make an unexplained upgrade failure pass. The wrapper rejects snapshot updates
in CI; CI compares the checked-in images.

Known defects are recorded in `tests/baselines/reference.json`:

- `MISSING-FURY-RIBBONS`: the master lists 78 entries, but
  `samsy/fury-ribbons` has no archived manifest/entrypoint. The expected API has 77.
- `ENCODING-SVG`: ordinary shell SVG bytes are incorrectly labelled gzip.
- `ENCODING-404`: missing static JS returns HTML with an incorrect gzip header.
- `MEDIA-PLAY-ABORT`: rapidly hovering a thumbnail can interrupt its pending
  video `play()` call. The exact observed cancellation is annotated; other
  browser errors and failed requests still fail tests.

The two encoding checks use Playwright's expected-failure mechanism. An
unexpected pass fails the suite, prompting removal of that exception when the
underlying bug is fixed. Missing data cannot silently expand the exception list:
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
