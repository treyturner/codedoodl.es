# Candidate release and rollback

Stage 6 prepares and validates the local candidate. Registry publication,
self-hosted rollout, real-device review and production promotion are separate
operator steps; the local validation record does not claim they have happened.
The asset archive remains pinned at
`9f42ed5c072a3f5b01e14d7b9859cf883edd9a2a` throughout this migration.

## Build and publish a candidate

The build workflow runs on feature branches, PRs and master. It builds the runtime
image, enforces build/server/local-tool checks, audits the three npm graphs,
scans the runtime image, and runs HTTP/browser/artwork tests against pinned
assets. Failures prevent candidate publication and preserve diagnostics.

A successful master push publishes a candidate. A workflow dispatch can also
publish a feature-branch candidate by selecting `publish`. Ordinary feature
pushes and PRs do not publish. Both existing registries receive a unique
`candidate-COMMIT-RUN-ATTEMPT` tag; reruns cannot overwrite an earlier run's tag.
The workflow records and compares both registry digests in the job summary and
`candidate-digests.txt` artifact. A registry administrator can still move tags,
so deploy using the recorded **digest**, never by relying on tag immutability.
The build workflow no longer updates `latest` automatically.

## Validate the exact image on the host

Before changing the service, retain its current image reference and deployment
environment. Pull the candidate using the recorded
`forgejo.treyturner.info/treyturner/codedoodles@sha256:...` reference. Start it as
a separate instance behind a temporary host route, using the existing asset URL
and the candidate's own `BASE_URL`; avoid changing the assets or replacing the
running production container during this check.

Verify health/readiness, production manifest count (77), an existing shortlink,
a deep-link reload, grid/video previews, next/previous/random, info links and
representative Canvas/WebGL artwork through the actual TLS reverse proxy. Review
the 77-artwork report and screenshots; recorded draw calls prove execution, not
artistic correctness. On real mobile Safari and Chrome, check touch, rotation,
WebGL, media and the warning/video fallback crossing 750 CSS pixels. If using the
password gate, verify proxy trust, secure session cookies and login. Stop/restart
the candidate and confirm it becomes ready again.

Record host, time, candidate digest, results and any accepted archive defects.
Do not substitute a newly rebuilt image after this review.

## Promote without rebuilding

After the candidate source is included in master and host/device checks pass,
run **Promote tested codedoodles candidate** on master. Supply the candidate tag,
its tested digest, and the host-validation confirmation. The workflow verifies
that the source commit is in master and that both registry candidate tags still
resolve to that digest. It copies that exact manifest to each `latest` tag and
verifies the result. It does not rebuild or pull/tag a different platform image.
Feature branches cannot execute this promotion job.

For a read-only preflight with registry access:

```bash
bash scripts/promote-image.sh treyturner candidate-COMMIT-RUN-ATTEMPT sha256:DIGEST
```

The script defaults to a dry run; only `--apply` changes tags. Two registries
cannot be updated atomically. If one promotion fails, inspect both digests and
rerun the same reviewed inputs; the operation is idempotent. Production should
continue using a pinned digest regardless of tag state. Apply the tested digest
to the existing host deployment and repeat the brief smoke checks.

## Rollback

The operator confirmed this prior working production image on `vault`, container
`doodles`:

```text
forgejo.treyturner.info/treyturner/codedoodles@sha256:944e942f72c9fa0cce4ef8287eff3f89f2c04b1af3bb322ce884b59bcb039081
```

Its image ID is
`sha256:982d7cfc77d0de2fbbf1ef3f84896674cad25c1d176406c6ef42f9518c35bd54`.
The same registry digest exists at `ghcr.io/treyturner/codedoodles`.
See [the original record](../tests/baselines/reference.json).

Keep that image cached on the host. To roll back, restore the digest in the
existing deployment configuration, recreate only the app service using its
previous environment, and check `/health`, `/api/doodles`, a shortlink and a
sketch. No asset rollback or data migration is required. Avoid pruning the old
image until the new deployment has been accepted.
