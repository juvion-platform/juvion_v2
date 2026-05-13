# Schema-Driven Configuration UI (Strategic Gap 3)

**Source:** `Juvion_vs_CampX_Strategic_Comparison.pdf` §4.3 — "PARITY REQUIRED for the four most-used config domains. v1.0."

## Why this matters

CampX onboards institutions without engineering involvement. A new fee
type, a new naming series, a new admission registration field, a new
notification — all are **configurations**, not code changes. Their data-
imports system uses the same pattern; so does ReportsForge,
institution-config, student-services, registration-form-config,
notifications, and naming-series. **Seven** schema-driven subsystems
share a single back-end pattern: the back-end describes what fields a
record has and what constraints apply; the front-end renders form/list
automatically.

Juvion has built a single instance of this pattern (the bulk-import
registry, Strategic Gap 2). The *pattern itself* now needs to be
generalized so that institution-config, notification-templates, and
admission-form-config can ride on the same rails.

Without this, every new tenant requires a code change to add a flag,
template, or form field — exactly the engineering-coupled onboarding
that breaks the architectural-edge pitch.

## What we're building

A schema-driven **runtime configuration registry** under M12 Platform
(`/api/platform/config/*`). One registry, two cardinalities:

- **Single-record per college** — institution-config-shaped (e.g.
  feature flags, default notification settings). Exactly one document
  per `(collegeId, configType)`.
- **Multi-record per college** — catalog-shaped (e.g. notification
  templates, fee-types). Many documents per `(collegeId, configType)`,
  keyed by an admin-set `identifier`.

A new config type is added by **appending one registry entry** in
`backend/src/modules/platform/config-registry.ts`. No new model, no
new service, no new route, no new frontend page. The generic front-
end consumes the schema and renders the right form.

## Acceptance criteria — Phase A

1. **One new model**: `ConfigEntry` — generic `(collegeId, configType,
   identifier, values)` collection with a compound unique index on
   `(collegeId, configType, identifier)`. Values stored as `Schema.
   Types.Mixed` so any registered schema can persist its shape.

2. **One new registry** (`config-registry.ts`) exporting:
   - `ConfigField` interface — `key`, `label`, `type` (string / number /
     boolean / select / multiselect / textarea / date), `required`,
     `helpText`, `default`, `options[]` for selects.
   - `ConfigSchema` interface — `type`, `label`, `description`,
     `cardinality`, `fields[]`, optional `identifierField` for multi.
   - `CONFIG_REGISTRY` map — array of `ConfigSchema`s, looked up by
     `type`.

3. **Two config types registered in Phase A**:
   - `institution-feature-flags` (single, per college) — boolean
     toggles for: optional-allotment, email-notifications, sms-
     notifications, whatsapp-notifications, juvi-ai-suggestions, parent-
     portal, finance-blocking-exams, bulk-import-portal.
   - `notification-templates` (multi, per college) — admin-managed
     templates with `code` (identifier), `name`, `channel` (email /
     sms / whatsapp / app), `subject` (optional), `body`,
     `enabled`. Variable substitution (e.g. `{{studentName}}`) is
     just-store-the-string in Phase A; resolver lives in M12
     communication service and reads templates at send time
     (Phase B).

4. **Generic service** with these operations:
   - `listConfigTypes()` — returns all registered schemas (so the UI
     can render a hub page).
   - `getConfigSchema(type)` — returns one schema definition.
   - `getConfigEntries(collegeId, type)` — list entries. For single-
     cardinality, returns one entry (or the registry default if none).
   - `getConfigEntry(collegeId, type, identifier?)` — fetch one.
   - `upsertConfigEntry(collegeId, type, values, identifier?,
     performedBy)` — write one. Validates against the registered
     schema (required, type, enum). For single-cardinality, identifier
     is ignored and the single document is upserted.
   - `deleteConfigEntry(collegeId, type, identifier, performedBy)` —
     only valid for multi-cardinality.

5. **Generic routes** mounted on M12 Platform:
   - `GET  /platform/config/types`
   - `GET  /platform/config/:type/schema`
   - `GET  /platform/config/:type`
   - `GET  /platform/config/:type/:identifier`
   - `PUT  /platform/config/:type/:identifier` (or no identifier for
     single)
   - `DELETE /platform/config/:type/:identifier`

   All under `authorize('platform', 'admin')`.

6. **Generic frontend** — a single page (`SchemaConfigPage.tsx`) that:
   - Reads `/config/types` to render a navigation hub.
   - On selecting a type, reads `/config/:type/schema` + entries.
   - For single-cardinality: renders one form with all schema fields,
     `Save` button upserts.
   - For multi-cardinality: renders a list + add/edit modal whose form
     is auto-built from the schema fields.
   - Boolean fields → checkbox; select → dropdown; textarea → multi-
     line; multiselect → chip picker; date → date picker.

7. **Wired into M12 Platform** hub with a new "Configuration" card.

## Non-functional criteria

- **Pattern-first**: Adding a new config type must be a single-file
  registry change. The frontend page should never need editing per
  new config type.
- **Validation on write**: required + type checks happen server-side
  (frontend validation is duplicate, not authoritative).
- **Backward compatible**: env-var feature flags (`config/features.ts`)
  stay valid. The new DB-backed flags are an OVERLAY — when DB has
  no entry for the college, fall back to env defaults. This is the
  Phase A read path.
- **Audit log**: every upsert/delete goes through `createAuditLog`
  (existing pattern).

## Phased breakdown

**Phase A (this session)**
- Backend: `ConfigEntry` model + `config-registry.ts` + generic
  service + routes + 2 registered types.
- Frontend: `SchemaConfigPage` + nav card in M12 Platform.

**Phase B**
- Register `registration-form-config` (admission form shape per
  programme). Wire applicant-form to read the schema.
- Re-front the existing `fee-types` page through the registry pattern
  (read existing FeeCategory model, render via the same schema-driven
  form). Demonstrates the pattern across heterogeneous storage.
- Notification template **resolver** in M12 communication service —
  resolve `{{studentName}}` etc. at send time.

**Phase C**
- AI-assisted config (the doc's differentiation opportunity): "What's
  a reasonable fee structure for a JNTU-affiliated B.Tech CSE
  programme?" — Juvi proposes, admin edits.
