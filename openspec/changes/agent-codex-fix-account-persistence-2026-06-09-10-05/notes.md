# agent-codex-fix-account-persistence-2026-06-09-10-05 (minimal / T1)

Branch: `agent/codex/fix-account-persistence-2026-06-09-10-05`

Fix account isolation so per-terminal Codex sessions keep their selected authmux
account and Claude parallel aliases launch with per-account `CLAUDE_CONFIG_DIR`
plus an explicit Cue profile.

## Handoff

- Handoff: change=`agent-codex-fix-account-persistence-2026-06-09-10-05`; branch=`agent/codex/fix-account-persistence-2026-06-09-10-05`; scope=`src/commands/parallel.ts, src/lib/config/login-hook.ts, scripts/postinstall-login-hook.cjs, tests`; action=`finish via PR after verification`.
- Verification: `npm run build`; `node dist/tests/login-hook.test.js`; `node dist/tests/json-parity.test.js` (escalated because sandbox blocks child node spawn); live smoke `claude-account1 --version`, `claude-account2 --version`.
- Live config: backed up `/home/deadpool/.bashrc` to `/home/deadpool/.bashrc.authmux-backup-20260609-0814`, refreshed Claude aliases, and patched the active `codex()` shell wrapper to use `authmux` session restore/sync.
- Full suite note: `npm test` had 192/195 passing; only `skills-profile` tests failed because `/home/deadpool/Documents/soul` is absent in this environment.

## Cleanup

- [ ] Run: `gx branch finish --branch agent/codex/fix-account-persistence-2026-06-09-10-05 --base main --via-pr --wait-for-merge --cleanup`
- [ ] Record PR URL + `MERGED` state in the completion handoff.
- [ ] Confirm sandbox worktree is gone (`git worktree list`, `git branch -a`).
