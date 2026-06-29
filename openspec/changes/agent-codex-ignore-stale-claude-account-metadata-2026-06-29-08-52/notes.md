# agent-codex-ignore-stale-claude-account-metadata-2026-06-29-08-52 (minimal / T1)

Branch: `agent/codex/ignore-stale-claude-account-metadata-2026-06-29-08-52`

Ignore stale `.claude.json` OAuth account UUID metadata when newer `.credentials.json` exists, so different credentials are not falsely flagged as duplicate accounts.

## Handoff

- Handoff: change=`agent-codex-ignore-stale-claude-account-metadata-2026-06-29-08-52`; branch=`agent/codex/ignore-stale-claude-account-metadata-2026-06-29-08-52`; scope=`src/commands/parallel.ts src/tests/json-parity.test.ts README.md`; action=`finish stale Claude metadata handling and refresh live build/wrappers after merge`.
- Copy prompt: Continue `agent-codex-ignore-stale-claude-account-metadata-2026-06-29-08-52` on branch `agent/codex/ignore-stale-claude-account-metadata-2026-06-29-08-52`. Work inside the existing sandbox, review `openspec/changes/agent-codex-ignore-stale-claude-account-metadata-2026-06-29-08-52/notes.md`, continue from the current state instead of creating a new sandbox, and when the work is done run `gx branch finish --branch agent/codex/ignore-stale-claude-account-metadata-2026-06-29-08-52 --base main --via-pr --wait-for-merge --cleanup`.

## Cleanup

- [ ] Run: `gx branch finish --branch agent/codex/ignore-stale-claude-account-metadata-2026-06-29-08-52 --base main --via-pr --wait-for-merge --cleanup`
- [ ] Record PR URL + `MERGED` state in the completion handoff.
- [ ] Confirm sandbox worktree is gone (`git worktree list`, `git branch -a`).
