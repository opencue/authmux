#!/usr/bin/env bash
# claude-parallel-setup.sh — Set up parallel Claude Code accounts.
# Usage: ./scripts/claude-parallel-setup.sh [account_names...]

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

detect_shell() {
  case "${SHELL:-}" in
    *fish*) printf 'fish' ;;
    *zsh*) printf 'zsh' ;;
    *) printf 'bash' ;;
  esac
}

authmux_cmd=()
if command -v authmux >/dev/null 2>&1; then
  authmux_cmd=(authmux)
elif [[ -f "$repo_root/dist/index.js" ]]; then
  authmux_cmd=(node "$repo_root/dist/index.js")
else
  echo "authmux is not installed and $repo_root/dist/index.js is missing. Run: npm run build" >&2
  exit 1
fi

names=("$@")
if [[ ${#names[@]} -eq 0 ]]; then
  names=(account1 account2)
  echo "No names given, using defaults: ${names[*]}"
fi

for name in "${names[@]}"; do
  "${authmux_cmd[@]}" parallel --add "$name"
done

shell="$(detect_shell)"
"${authmux_cmd[@]}" parallel --install --shell "$shell"

echo ""
echo "Installed session-isolated Claude parallel wrappers for $shell."
echo "Run: authmux parallel --doctor --shell $shell"
