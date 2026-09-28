# Dependency maintenance and audit policy

Stage 6 was audited on 2026-09-27. Run fresh audits before each release; these
results are a dated observation, not a permanent security guarantee.

| Scope | Result |
| --- | --- |
| Application runtime npm graph | 0 findings |
| Build/local-tool npm graph | 4 low findings, one underlying Elliptic advisory; 0 moderate/high/critical |
| Playwright test npm graph | 0 findings |
| Final Trixie runtime image | 0 critical, 43 high, 53 medium, 56 low, 2 unknown OS package findings; 0 Node package findings |

The 43 high OS findings represent eight CVEs repeated across binary packages.
Their exact package/version scope, explanation, owner and expiry are in
[`security/image-exceptions.json`](../security/image-exceptions.json). They have
no fixed version available in Debian 13 at this checkpoint. These are explicit
exceptions, not a claim that the scanner is clean. They expire **2026-11-01**.

The Node 24.21.0 image now uses pinned Debian Trixie instead of Bookworm. npm,
npx, Corepack and Yarn are removed from the final stage; the app starts Node
directly. This removes nine bundled npm dependency findings (four high) without
altering the application graph. Package managers remain in build stages. Debian's
package database is retained so scanners can continue to inspect the image.

## Run the gates

```bash
npm run audit:dependencies
bash scripts/scan-image.sh codedoodles:stage6
```

Audits write separate runtime, build and test reports to
`tests/artifacts/security/`. An unavailable audit service, malformed report or
high/critical npm finding fails the command. Low/moderate findings remain visible
for review. The image scanner is pinned in `security/Dockerfile`; it scans a
saved copy of the actual runtime image without mounting the Docker socket.
A high/critical image finding fails unless it matches an unexpired, explicitly
reviewed package/version/severity exception **and still has no fixed version**.
New findings, severity increases and available fixes require action. Reports are
retained in CI artifacts even when checks fail. `npm audit fix --force` is not
part of this workflow.

## OS exceptions

All exceptions are owned by the container maintainers. Reassess them whenever
runtime privileges, subprocess execution or the base distribution changes; update
the pinned base when Debian fixes become available. The shipped app runs as UID
1000, processes JSON over HTTP, and does not provide upload/archive extraction,
OS user management, shell execution, terminal database or mount/ACL operations.

| CVE | Reviewed exposure |
| --- | --- |
| [CVE-2026-76642](https://security-tracker.debian.org/tracker/CVE-2026-76642) | Privileged mount helper/post-hook path; no application mount calls or fstab user mounts. |
| [CVE-2026-78408](https://security-tracker.debian.org/tracker/CVE-2026-78408) | Operator's privileged `nsenter --join-cgroup`; no corresponding runtime operation. |
| [CVE-2026-78409](https://security-tracker.debian.org/tracker/CVE-2026-78409) | fstab-authorized `X-mount.subdir` path traversal; no such mounts. |
| [CVE-2026-78410](https://security-tracker.debian.org/tracker/CVE-2026-78410) | Privileged fstab bind-mount race; no such mounts. |
| [CVE-2026-54369](https://security-tracker.debian.org/tracker/CVE-2026-54369) | Privileged libacl pathname operations; Node does not link libacl and the app does not invoke ACL tools. |
| [CVE-2026-16742](https://security-tracker.debian.org/tracker/CVE-2026-16742) | `systemd-homed`; shared libraries are installed but the vulnerable daemon is absent. |
| [CVE-2025-69720](https://security-tracker.debian.org/tracker/CVE-2025-69720) | `infocmp` terminal-description parser; not invoked by the app. |
| [CVE-2026-9538](https://security-tracker.debian.org/tracker/CVE-2026-9538) | Perl Archive::Tar; the app does not execute Perl or extract tar archives. |

These exposure assessments are based on the current app and ordinary non-root
container operation. They do not apply to a privileged container, added host
administration tools or a restored legacy deployment path.

## Remaining build and browser exceptions

The low [Elliptic advisory GHSA-848j-6mx2-7j84](https://github.com/advisories/GHSA-848j-6mx2-7j84)
propagates through `crypto-browserify`, `create-ecdh` and `browserify-sign` in
Browserify's dependency graph. No patched Elliptic release exists at this
checkpoint. The application does not use those cryptographic shims: a dependency
graph check verifies they do not enter the browser bundle, and production does
not install Browserify. Owner: build maintainers. Review on each Browserify or
browser dependency update. Replacement task: move browser bundling to a maintained
pipeline without Node crypto shims, preserving CoffeeScript transforms and the
existing browser/visual gates; do not force an incompatible transitive override.

The retained DeepModel compatibility fork has its own owner, tests and
replacement task in [browser.md](browser.md#frozen-dependency-exception-deepmodel).
The Node/npm pairing remains Node 24.21.0 with its bundled npm 11.19.0; npm is
build-only and will advance with the tested Node toolchain. Archived artwork's
embedded libraries are a separate restoration scope, not this app's npm graph.

## Update automation

Dependabot checks application npm, test npm, all three Dockerfiles, and action
SHA pins weekly. It becomes active when this configuration reaches the default
branch. Updates are reviewed, never auto-merged. Review actions independently of
application updates; keep full commit pins. Keep Playwright's package, lockfile
and container version together, and review screenshots without automatically
regenerating them. Node changes must keep `.nvmrc`, `packageManager`, `engines`
and Docker pins aligned. Retired AWS/S3 tools remain outside normal installation.
