# agent-codex-make-codex-launch-through-cue-2026-06-09-10-30 (minimal / T1)

Branch: `agent/codex/make-codex-launch-through-cue-2026-06-09-10-30`

Make the generated `codex()` authmux shell hook launch Codex through Cue by
default with `AUTHMUX_CODEX_CUE_PROFILE` override and
`AUTHMUX_SKIP_CUE_LAUNCH` escape hatch.

## Handoff

- Handoff: change=`agent-codex-make-codex-launch-through-cue-2026-06-09-10-30`; branch=`agent/codex/make-codex-launch-through-cue-2026-06-09-10-30`; scope=`src/lib/config/login-hook.ts, scripts/postinstall-login-hook.cjs, src/tests/login-hook.test.ts`; action=`finish via PR`.
- Verification: `node dist/tests/login-hook.test.js`; `npm test` (195/195 passing).
- Smoke note: direct `cue launch codex --cue-profile core --version` escalation timed out twice in auto-review, so full live smoke will be done after merge by sourcing updated `.bashrc`.

## Cleanup

- [ ] Run: `gx branch finish --branch agent/codex/make-codex-launch-through-cue-2026-06-09-10-30 --base main --via-pr --wait-for-merge --cleanup`
- [ ] Record PR URL + `MERGED` state in the completion handoff.
- [ ] Confirm sandbox worktree is gone (`git worktree list`, `git branch -a`).
