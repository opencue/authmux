# agent-codex-fix-cue-aliases-and-skills-tests-2026-06-09-10-24 (minimal / T1)

Branch: `agent/codex/fix-cue-aliases-and-skills-tests-2026-06-09-10-24`

Keep Claude account aliases launching through Cue while separating Soul skill
profile from Cue profile. Make skill-profile tests self-contained with a temp
Soul fixture so they pass on hosts without `~/Documents/soul`.

## Handoff

- Handoff: change=`agent-codex-fix-cue-aliases-and-skills-tests-2026-06-09-10-24`; branch=`agent/codex/fix-cue-aliases-and-skills-tests-2026-06-09-10-24`; scope=`src/commands/parallel.ts, src/tests/json-parity.test.ts, src/tests/skills-profile.test.ts`; action=`finish via PR`.
- Verification: `npm run build`; `node dist/tests/skills-profile.test.js`; `node dist/tests/json-parity.test.js`; `npm test` (195/195 passing); live smoke `claude-account1 --version`, `claude-account2 --version`.
- Live config: refreshed `/home/deadpool/.bashrc` aliases; `claude-account1` and `claude-account2` now expand to `__authmux_claude_account '<account>' 'base' 'core'`.

## Cleanup

- [ ] Run: `gx branch finish --branch agent/codex/fix-cue-aliases-and-skills-tests-2026-06-09-10-24 --base main --via-pr --wait-for-merge --cleanup`
- [ ] Record PR URL + `MERGED` state in the completion handoff.
- [ ] Confirm sandbox worktree is gone (`git worktree list`, `git branch -a`).
