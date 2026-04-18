# Completion: Task 14 — Migration script

**Completed:** 2026-04-18 · **Status:** Done · **Tests:** 6/6

Retrofits legacy allocations with `proposedAt`/`respondedAt`/`respondedBy = studentId`. Idempotent. npm script added: `migrate:optional-allotment`.
Used `.lean()` on CampusConfig query to bypass Mongoose default re-hydration — worth documenting for future migration authors.
