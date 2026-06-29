# agent-codex-harden-claude-parallel-sessions-2026-06-29-23-09 (minimal / T1)

Branch: `agent/codex/harden-claude-parallel-sessions-2026-06-29-23-09`

Harden Claude parallel session isolation: locked atomic credential sync, stale session inventory/cleanup, conflict warnings, doctor checks, and live wrapper refresh after primary builds.

## Handoff

- Handoff: change=`agent-codex-harden-claude-parallel-sessions-2026-06-29-23-09`; branch=`agent/codex/harden-claude-parallel-sessions-2026-06-29-23-09`; scope=`src/commands/parallel.ts src/tests/json-parity.test.ts README.md package.json scripts/postbuild-parallel-install.cjs`; action=`implement all requested Claude parallel hardening and finish via PR`.
- Copy prompt: Continue `agent-codex-harden-claude-parallel-sessions-2026-06-29-23-09` on branch `agent/codex/harden-claude-parallel-sessions-2026-06-29-23-09`. Work inside the existing sandbox, review `openspec/changes/agent-codex-harden-claude-parallel-sessions-2026-06-29-23-09/notes.md`, continue from the current state instead of creating a new sandbox, and when the work is done run `gx branch finish --branch agent/codex/harden-claude-parallel-sessions-2026-06-29-23-09 --base main --via-pr --wait-for-merge --cleanup`.

## Verification

- `npm run build` passed.
- `node dist/tests/json-parity.test.js` passed: 19 tests.
- `npm test` passed: 204 tests.
- `node dist/index.js parallel --help` shows `--sessions`, `--clean-sessions`, and `--doctor`.
- `node dist/index.js parallel --doctor --shell fish --json` reports existing Fish wrappers use `authmux parallel --run`.

## Cleanup

- [ ] Run: `gx branch finish --branch agent/codex/harden-claude-parallel-sessions-2026-06-29-23-09 --base main --via-pr --wait-for-merge --cleanup`
- [ ] Record PR URL + `MERGED` state in the completion handoff.
- [ ] Confirm sandbox worktree is gone (`git worktree list`, `git branch -a`).
