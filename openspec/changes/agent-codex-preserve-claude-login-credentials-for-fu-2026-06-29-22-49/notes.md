# agent-codex-preserve-claude-login-credentials-for-fu-2026-06-29-22-49 (minimal / T1)

Branch: `agent/codex/preserve-claude-login-credentials-for-fu-2026-06-29-22-49`

Preserve live Claude parallel sessions by launching them from per-session config copies, while syncing changed login credentials back to the canonical profile for future launches.

## Handoff

- Handoff: change=`agent-codex-preserve-claude-login-credentials-for-fu-2026-06-29-22-49`; branch=`agent/codex/preserve-claude-login-credentials-for-fu-2026-06-29-22-49`; scope=`src/commands/parallel.ts src/tests/json-parity.test.ts README.md`; action=`add session-isolated Claude parallel launcher and finish via PR`.
- Copy prompt: Continue `agent-codex-preserve-claude-login-credentials-for-fu-2026-06-29-22-49` on branch `agent/codex/preserve-claude-login-credentials-for-fu-2026-06-29-22-49`. Work inside the existing sandbox, review `openspec/changes/agent-codex-preserve-claude-login-credentials-for-fu-2026-06-29-22-49/notes.md`, continue from the current state instead of creating a new sandbox, and when the work is done run `gx branch finish --branch agent/codex/preserve-claude-login-credentials-for-fu-2026-06-29-22-49 --base main --via-pr --wait-for-merge --cleanup`.

## Verification

- `npm run build` passed.
- `node dist/tests/json-parity.test.js` passed; sandboxed run hit `spawnSync node EPERM`, so verification ran with Guardex-approved escalation.
- `npm test` passed: 200 tests.

## Cleanup

- [ ] Run: `gx branch finish --branch agent/codex/preserve-claude-login-credentials-for-fu-2026-06-29-22-49 --base main --via-pr --wait-for-merge --cleanup`
- [ ] Record PR URL + `MERGED` state in the completion handoff.
- [ ] Confirm sandbox worktree is gone (`git worktree list`, `git branch -a`).
