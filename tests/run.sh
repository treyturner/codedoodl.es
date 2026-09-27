#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir"
source tests/assets.lock
if [[ "${ARTWORK_RECORD:-0}" == 1 && -n "${CI:-}" ]]; then
  echo 'Record original artwork observations locally; CI only compares them.' >&2
  exit 1
fi
export BASELINE_UID="$(id -u)" BASELINE_GID="$(id -g)"
export BASELINE_RUNNER_IMAGE="${BASELINE_RUNNER_IMAGE:-codedoodles-baseline-runner:local}"
project="codedoodles-baseline-$(date +%s)-$$"

if [[ -z "${DOODLES_ARCHIVE:-}" ]]; then
  if [[ -d tests/archive/.git ]]; then
    export DOODLES_ARCHIVE="$repo_dir/tests/archive"
  else
    export DOODLES_ARCHIVE="$(dirname "$repo_dir")/codedoodl.es-doodles"
  fi
fi
DOODLES_ARCHIVE="$(cd "$DOODLES_ARCHIVE" && pwd)"
export DOODLES_ARCHIVE
if [[ "$(git -C "$DOODLES_ARCHIVE" rev-parse HEAD)" != "$ASSETS_COMMIT" ]] ||
   [[ -n "$(git -C "$DOODLES_ARCHIVE" status --porcelain --untracked-files=normal)" ]]; then
  echo "Tests require a clean assets checkout at $ASSETS_COMMIT ($ASSETS_REPOSITORY)." >&2
  exit 1
fi
export BASELINE_SNAPSHOT_MODE=ro
for argument in "$@"; do
  if [[ "$argument" == --update-snapshots* || "$argument" == -u ]]; then
    if [[ -n "${CI:-}" ]]; then
      echo 'Update and review snapshots locally; CI must only compare them.' >&2
      exit 1
    fi
    export BASELINE_SNAPSHOT_MODE=rw
  fi
done

export TEST_RESULTS_DIR="${TEST_RESULTS_DIR:-$repo_dir/tests/artifacts}"
mkdir -p "$TEST_RESULTS_DIR" tests/baselines
TEST_RESULTS_DIR="$(cd "$TEST_RESULTS_DIR" && pwd)"
export TEST_RESULTS_DIR
if [[ -z "${CODEDOODLES_IMAGE:-}" ]]; then
  export CODEDOODLES_IMAGE="codedoodles:baseline-$project"
  docker build --progress=plain -t "$CODEDOODLES_IMAGE" . 2>&1 | tee "$TEST_RESULTS_DIR"/build.log
fi
docker build --progress=plain -t "$BASELINE_RUNNER_IMAGE" tests 2>&1 | tee "$TEST_RESULTS_DIR"/runner-build.log
docker image inspect "$CODEDOODLES_IMAGE" --format '{{json .}}' > "$TEST_RESULTS_DIR"/image.json
git rev-parse HEAD > "$TEST_RESULTS_DIR"/application-commit.txt
git -C "$DOODLES_ARCHIVE" rev-parse HEAD > "$TEST_RESULTS_DIR"/assets-commit.txt

compose=(docker compose -p "$project" -f tests/compose.yml)
cleanup() {
  result=$?
  trap - EXIT
  "${compose[@]}" logs --no-color > "$TEST_RESULTS_DIR"/containers.log 2>&1 || true
  "${compose[@]}" down --timeout 5 --remove-orphans > "$TEST_RESULTS_DIR"/cleanup.log 2>&1 || true
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# Start the archive before the application's initial data load.
"${compose[@]}" up -d assets
"${compose[@]}" run --rm --no-deps runner node support/wait.mjs http://assets:8080/health
"${compose[@]}" up -d app preview auth fallback partial
"${compose[@]}" run --rm --no-deps runner npm test -- "$@"

# Verify the actual container entrypoint receives SIGTERM and restarts ready.
"${compose[@]}" stop --timeout 8 app > "$TEST_RESULTS_DIR"/lifecycle.log 2>&1
app_container="$("${compose[@]}" ps -a -q app)"
exit_code="$(docker inspect --format '{{.State.ExitCode}}' "$app_container")"
if [[ "$exit_code" != 0 ]]; then
  echo "Application did not stop cleanly (exit $exit_code)." >&2
  exit 1
fi
"${compose[@]}" start app >> "$TEST_RESULTS_DIR"/lifecycle.log 2>&1
"${compose[@]}" run --rm --no-deps runner node support/wait.mjs http://site.test:3000/health >> "$TEST_RESULTS_DIR"/lifecycle.log 2>&1
echo 'PASS: container SIGTERM exit 0 and restart readiness' | tee -a "$TEST_RESULTS_DIR"/lifecycle.log
