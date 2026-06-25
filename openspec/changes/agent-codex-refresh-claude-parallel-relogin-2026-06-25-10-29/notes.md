# agent-codex-refresh-claude-parallel-relogin-2026-06-25-10-29 (minimal / T1)

Branch: `agent/codex/refresh-claude-parallel-relogin-2026-06-25-10-29`

Refresh Claude parallel account relogin behavior so login/logout and missing credentials bypass Cue and write OAuth tokens directly into the selected `CLAUDE_CONFIG_DIR`. Add Fish function installation because the live shell is Fish, and ignore dot-directories in `~/.claude-accounts` so backups are not treated as profiles.

Verification:
- `npm run build`
- `node dist/tests/json-parity.test.js`
- live `fish -lc 'type claude-account1; type claude-account2'`
- live `fish -lc 'claude-account1 --version; claude-account2 --version'`
- live `authmux forecast` shows both Claude accounts unhealthy/unknown after intentional credential removal.

## Handoff

- Handoff: change=`agent-codex-refresh-claude-parallel-relogin-2026-06-25-10-29`; branch=`agent/codex/refresh-claude-parallel-relogin-2026-06-25-10-29`; scope=`src/commands/parallel.ts, src/tests/json-parity.test.ts, README.md`; action=`finish via PR after verification`.
- Copy prompt: Continue `agent-codex-refresh-claude-parallel-relogin-2026-06-25-10-29` on branch `agent/codex/refresh-claude-parallel-relogin-2026-06-25-10-29`. Work inside the existing sandbox, review `openspec/changes/agent-codex-refresh-claude-parallel-relogin-2026-06-25-10-29/notes.md`, continue from the current state instead of creating a new sandbox, and when the work is done run `gx branch finish --branch agent/codex/refresh-claude-parallel-relogin-2026-06-25-10-29 --base main --via-pr --wait-for-merge --cleanup`.

## Cleanup

- [ ] Run: `gx branch finish --branch agent/codex/refresh-claude-parallel-relogin-2026-06-25-10-29 --base main --via-pr --wait-for-merge --cleanup`
- [ ] Record PR URL + `MERGED` state in the completion handoff.
- [ ] Confirm sandbox worktree is gone (`git worktree list`, `git branch -a`).
