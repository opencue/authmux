# agent-codex-fix-claude-account-relogin-isolation-2026-06-29-08-16 (minimal / T1)

Branch: `agent/codex/fix-claude-account-relogin-isolation-2026-06-29-08-16`

Diagnose Claude parallel-account relogin bleed and surface duplicate Claude credentials/OAuth account state in `authmux parallel`.

## Handoff

- Handoff: change=`agent-codex-fix-claude-account-relogin-isolation-2026-06-29-08-16`; branch=`agent/codex/fix-claude-account-relogin-isolation-2026-06-29-08-16`; scope=`src/commands/parallel.ts src/tests/json-parity.test.ts README.md`; action=`detect duplicate Claude credentials/account UUIDs and warn that shared profiles are not independent`.
- Copy prompt: Continue `agent-codex-fix-claude-account-relogin-isolation-2026-06-29-08-16` on branch `agent/codex/fix-claude-account-relogin-isolation-2026-06-29-08-16`. Work inside the existing sandbox, review `openspec/changes/agent-codex-fix-claude-account-relogin-isolation-2026-06-29-08-16/notes.md`, continue from the current state instead of creating a new sandbox, and when the work is done run `gx branch finish --branch agent/codex/fix-claude-account-relogin-isolation-2026-06-29-08-16 --base main --via-pr --wait-for-merge --cleanup`.

## Cleanup

- [ ] Run: `gx branch finish --branch agent/codex/fix-claude-account-relogin-isolation-2026-06-29-08-16 --base main --via-pr --wait-for-merge --cleanup`
- [ ] Record PR URL + `MERGED` state in the completion handoff.
- [ ] Confirm sandbox worktree is gone (`git worktree list`, `git branch -a`).
