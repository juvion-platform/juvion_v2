# Spec Effectiveness Tracking

## Feature: optional-hostel-transport-allotment

**Spec created:** 2026-04-17
**Feature closed:** 2026-04-18
**Total tasks:** 20

### Final score: **Adequate** (3 spec revisions, 0 rework tasks)

### Outcome metrics
- 20/20 tasks Done
- 0 tasks required rework after a completion signal was written
- 171 backend unit tests all passing, TypeScript strict clean
- 3 spec amendments mid-flight (RBAC glossary, subDomain enforcement handoff, refactor-permitted note)
- 12 spec gaps flagged across completion signals (all accommodated in-flight, none triggered rework)

### Revision history
- 2026-04-18 (post-T1): refactor-permitted note for clarifying extraction
- 2026-04-18 (post-T2): docker-compose deferral note
- 2026-04-18 (post-T11): RBAC glossary + subDomain enforcement handoff

### Gap patterns observed
| Pattern | Occurrences | Note |
|---|---|---|
| Reusable test infrastructure not pre-specified | 1 (T1 helper referenced by T3–T15) | Pre-declare shared test helpers in the spec when multi-task suites share infra. |
| Task-type vs. test-requirement mismatch | 1 (T2 Config+tests) | Either no tests (pure config) or reclassify as Code. |
| SubDomain semantics leak from spec to service layer | 1 (T11 → T8/T9/T10 handoff) | RBAC engine descriptor ≠ filter. Make service-level enforcement explicit. |
| Deployment files implied but not listed | 1 (T2 docker-compose) | List every env file when spec says "set X in env". |
| Pre-existing tech debt surfaced | 2 (CampusConfig dup index; AuditLog enum too narrow) | Track separately; don't bloat in-feature scope. |
| ObjectId type friction (Schema.Types vs mongoose.Types) | 4 tasks (T3–T7) | Wide-spread issue in helper signatures; resolved with loose `AllocationDocLike`. A project-wide model interface refactor would eliminate this. |
| Notification.sentBy requires ObjectId for system actors | 1 (T13) | Sentinel "system" ObjectId pattern. Document in notification contract. |
| Migration + Mongoose default rehydration | 1 (T14) | Use `.lean()` when testing "field absent" conditions. |
| Getter-based config object + destructuring | 1 (T2) | JSDoc warning only; future RBAC-style docs should call out. |

### Top lessons for future specs
1. **List reusable test helpers alongside the "files to modify/create" list** — saves downstream tasks from re-inventing setup.
2. **Never classify a task "Config" if it needs tests** — tests mean it's Code.
3. **When the engine relies on descriptors rather than filters**, the spec must explicitly assign enforcement responsibility to a downstream layer.
4. **Model interface/runtime type parity** (Schema.Types.ObjectId vs mongoose.Types.ObjectId) is a chronic friction point — worth resolving project-wide in a cleanup pass.

### Open follow-ups (out of feature scope, worth separate tickets)
- Remove CampusConfig duplicate `collegeId` index (pre-existing)
- Extend `AuditLog.action` enum to include semantic actions beyond create/update/delete
- Add `FEATURE_OPTIONAL_ALLOTMENT_PROPOSALS=false` to `docker-compose.yml` backend env block
- Supertest integration tests for T8/T9/T10 HTTP contract
- Wire `PendingProposalsWidget` into the Dashboard page
- Refactor model interfaces to use `mongoose.Types.ObjectId` consistently

## Project-wide insights (cross-feature)

This is the first feature tracked. Patterns will emerge after more features complete.
