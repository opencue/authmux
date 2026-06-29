# agent-codex-improve-claude-distinct-relogin-guard-2026-06-29-08-34 (minimal / T1)

Branch: `agent/codex/improve-claude-distinct-relogin-guard-2026-06-29-08-34`

Make Claude parallel relogin safer by backing up stale per-profile auth, forcing a fresh login path from generated wrappers, and rejecting duplicate Claude account results.

## Handoff

- Handoff: change=`agent-codex-improve-claude-distinct-relogin-guard-2026-06-29-08-34`; branch=`agent/codex/improve-claude-distinct-relogin-guard-2026-06-29-08-34`; scope=`src/commands/parallel.ts src/tests/json-parity.test.ts README.md`; action=`finish guarded Claude relogin implementation and verify generated bash/fish wrappers`.
- Copy prompt: Continue `agent-codex-improve-claude-distinct-relogin-guard-2026-06-29-08-34` on branch `agent/codex/improve-claude-distinct-relogin-guard-2026-06-29-08-34`. Work inside the existing sandbox, review `openspec/changes/agent-codex-improve-claude-distinct-relogin-guard-2026-06-29-08-34/notes.md`, continue from the current state instead of creating a new sandbox, and when the work is done run `gx branch finish --branch agent/codex/improve-claude-distinct-relogin-guard-2026-06-29-08-34 --base main --via-pr --wait-for-merge --cleanup`.

## Cleanup

- [ ] Run: `gx branch finish --branch agent/codex/improve-claude-distinct-relogin-guard-2026-06-29-08-34 --base main --via-pr --wait-for-merge --cleanup`
- [ ] Record PR URL + `MERGED` state in the completion handoff.
- [ ] Confirm sandbox worktree is gone (`git worktree list`, `git branch -a`).
