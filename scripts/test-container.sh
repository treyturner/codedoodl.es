#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
image="${1:?Usage: bash scripts/test-container.sh IMAGE}"

check() {
  local name="$1" port="$2" preview_port="$3" source="$4"
  shift 4
  # Use the image's environment defaults and runtime dependencies. The fixture
  # and application communicate only over loopback; no published ports or CDN.
  docker run --rm --init --network none -i "$@" --entrypoint node "$image" \
    - "$name" "$port" "$preview_port" "$source" \
    < "$repo_dir/tests/container/runtime.cjs"
}

check defaults 3000 3001 production
check platform-port 4101 4101 production -e PORT=4101
check bind-port-precedence 4102 4102 production -e PORT=4101 -e BIND_PORT=4102
check development-archive-override 3000 3001 development -e DOODLE_DATA_SOURCE=development
