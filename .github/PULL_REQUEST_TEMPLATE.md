## Summary

<!-- 1-3 bullets describing what changed and why. The "why" matters more than the "what" — the diff already shows the what. -->

-
-

## Test plan

<!-- Checklist of what was verified. CI is not the only signal. Manual smoke counts; so does "I ran the integration test against my dev backend." -->

- [ ] Typecheck both workspaces (`npm run typecheck`)
- [ ] Backend tests (`npm run test -w backend`)
- [ ] Frontend tests (`npm run test -w admin-portal`) — if FE touched
- [ ] E2E (`npm run test -w e2e`) — if user-facing surface touched
- [ ] Manual smoke against dev backend / portal — if behavior change

## Docs impact

<!-- The single most common drift source. If you changed any of these patterns, the doc must be updated in the SAME PR. AGENTS.md is a symlink to CLAUDE.md so updating one updates both. -->

Does this PR change a pattern that the next contributor will need to know about?

- [ ] Modules / route prefixes (new module, renamed module, removed route)
- [ ] Env vars (added, removed, renamed)
- [ ] RBAC (new persona code, new policy in `DEFAULT_POLICIES`, new `authorize()` callsite shape)
- [ ] Service-layer / controller / route convention (the `widget` example in CLAUDE.md)
- [ ] Fee-pin axes / scope-resolver / programme-transfer flow
- [ ] SDD workflow (gate criteria, artifact shape)
- [ ] E2E discipline (new fixture, new global-setup step)
- [ ] Anything else a reader of `CLAUDE.md` would expect to find

If **any** box is checked, CLAUDE.md is updated in this PR. (No box checked = no doc update needed; that's a valid answer.)

## Related

<!-- Optional: link any spec doc, prior PR, or issue this builds on. -->

🤖 Generated with [Claude Code](https://claude.com/claude-code)
