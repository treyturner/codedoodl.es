#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname -- "${BASH_SOURCE[0]}")/.."
image="${1:?Usage: bash scripts/scan-image.sh IMAGE}"
mkdir -p tests/artifacts/security temp
scan_dir="$(mktemp -d "$PWD/temp/image-scan.XXXXXX")"
trap 'rm -rf -- "$scan_dir"' EXIT
docker build -t codedoodles-scanner:local security
docker image save "$image" -o "$scan_dir/image.tar"
docker run --rm --user "$(id -u):$(id -g)" \
  -e TRIVY_CACHE_DIR=/tmp/trivy \
  -v "$scan_dir:/input:ro" -v "$PWD/tests/artifacts/security:/output" \
  codedoodles-scanner:local image --input /input/image.tar --scanners vuln \
  --format json --output /output/image.json
node scripts/image-policy.mjs tests/artifacts/security/image.json \
  | tee tests/artifacts/security/image-policy.json
