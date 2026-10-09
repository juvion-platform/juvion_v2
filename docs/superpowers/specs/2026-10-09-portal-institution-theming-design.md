# Institution accent themes the web portal — Design

**Status:** Draft for review (GATE 1)
**Date:** 2026-10-09
**Related:** `docs/superpowers/specs/2026-09-23-juvi-foundation-design.md` (§ Look and feel), `docs/superpowers/specs/2026-10-08-juvi-today-teaching-design.md`

---

## 1. Purpose

A college's brand colour should reach every surface its people use. Today it reaches exactly one.

- **The mobile app already complies.** `mobile/lib/app/theme.dart` builds `ColorScheme.fromSeed(seedColor: accent ?? kDefaultAccent)` from the institution's accent, fed by `College.juvi.accentColor` through `GET /api/juvi-app/v1/config`. `mobile/lib/app/app.dart:16` reads it, `parseHexColor` validates it.
- **The web portal does not.** Its palette is a fixed single brand frozen into `admin-portal/tailwind.config.js` — the "old Juvion" navy/blue/teal. A college that sets an accent sees its own brand on the phone and generic Juvion blue in the browser.

**Goal:** `College.juvi.accentColor` becomes the single source of brand colour for *both* surfaces. This spec delivers the web half; the mobile half already exists and is not changed.

**Intended outcome (the design brief):** an operator sets an accent once on `/platform/juvi → Settings` and both the phone and the browser show that college's brand, with no per-surface colour work and no rebuild of the portal.

### Success criteria

1. **No accent set → no visual change.** With `College.juvi.accentColor` unset, every computed colour in the portal is identical to today's. This is asserted by a unit test that deep-equals the frozen legacy ramp, not by eye.
2. **Accent set → the chrome follows it.** After `/auth/me` resolves, `--c-primary-*` and `--c-navy*` carry the ramp derived from that college's accent, on every authenticated page.
3. **Switching colleges re-themes.** A superadmin who selects a different college sees that college's brand without a manual reload.
4. **The edit surface stays small.** The 2879 hardcoded `primary-*`/`navy` class occurrences across ~300 files are **not** touched. `git diff --stat` on the portal shows no `.tsx` change except `main.tsx`, the 6 files carrying literal hexes, and new files.
5. `npm run typecheck` — 0 errors across all three workspaces; `npm test -w admin-portal` and the backend auth tests green.

### Non-goals (YAGNI)

- **No dark mode in the portal.** It has none today; adding one is a separate feature.
- **No per-user theme preference in the portal.** The mobile app has a device-level `ThemeMode` preference (`mobile/lib/features/me/theme_preference.dart`); the web has no settings surface for it and this spec does not add one.
- **`teal`, `orange` and `accent` ramps stay static.** They are semantic (teal = active/success, orange = warning, `accent` = the legacy purple used in 3 files). Only the brand ramps move.
- **The login page keeps the Juvion brand.** It is pre-auth, so no college is known. See §6.
- **No mobile change.** Already spec-compliant.
- **No new endpoint** — see §4.

---

## 2. Constraints discovered

These are facts about the current code, each verified, that bound the design.

| # | Constraint | Evidence |
|---|---|---|
| C1 | The accent is stored on `College.juvi.accentColor`, validated `/^#[0-9a-fA-F]{6}$/` | `backend/src/models/College.ts:55`; `IJuviConfig.accentColor` at `:7` |
| C2 | **No runtime theming hook of any kind exists** in the portal — no context, no CSS custom properties, no `setProperty`, no UI kit, no dark mode | portal `package.json` deps are react, react-dom, react-router-dom, @tanstack/react-query, axios, clsx, date-fns, lucide-react, zustand |
| C3 | The portal's own palette is static Tailwind ramps | `admin-portal/tailwind.config.js:6-63` |
| C4 | Blast radius is large. Occurrences / files: `primary-N` **2204 / 269**; `navy` **675 / 253**; `teal-N` 218 / 39; `orange-N` 109 / 26; `accent-N` 15 / 3; `bg-app` 1 / 1 | measured (see note) |

> **Note on the C4 numbers.** An earlier discovery pass reported `primary-N` as 1119 and `teal-N` as 116 against the *same* file counts (269, 39). Both are correct — that pass counted **lines containing** the token, this one counts **matches** (`grep -o`, so a `className` carrying three brand classes counts three times). Re-measured and reconciled to the digit: 1119 lines and 116 lines respectively. Occurrences is the meaningful unit here — each one is a class name whose resolved colour changes. **Total for the two ramps that actually move: 2879 occurrences across 269 + 253 files.**
| C5 | Opacity modifiers are used heavily — `hover:bg-` 639, `ring-` 270, e.g. `bg-teal-500/20`, `bg-primary-600/10` | measured |
| C6 | Literal hexes that a class-name repoint **cannot** reach: 14 occurrences in 6 files, plus 14 arbitrary-value `bg-[#…]` classes | `DashboardLayout.tsx`, `Login.tsx`, `CollegeSelector.tsx`, `finance/DashboardWidgets.tsx`, `platform/juvi/SettingsTab.tsx` (+ its test) |
| C7 | `/auth/me` is fetched on every boot and its payload is mapped **field-by-field** into the store | `admin-portal/src/stores/authStore.ts:145-162`, driven by `components/SessionWatcher.tsx` |
| C8 | `platform:read` is held by `super_admin`, `admin` and `principal` only; `staff` is explicitly **denied** `platform:'*'` | `backend/src/shared/rbac/defaults.ts:10-25`, `:101` |
| C9 | `GET /api/juvi-app/admin/settings` requires `platform:read` → unusable by HOD/faculty/staff | `backend/src/modules/juvi-app/admin/routes.ts:20` |
| C10 | `GET /api/juvi-app/v1/config` is mobile-only (`authenticateMobile`) | `backend/src/modules/juvi-app/config/routes.ts:8` |
| C11 | The only unauthenticated accent source, `GET /api/juvi-app/v1/institutions/:code`, is keyed by college **code**, which a portal session does not carry | `config/routes.ts:7`; `authStore.ts:14` |
| C12 | `authorize()` has no implicit read fallback; `engine.ts:81`'s `role: {$in: [role, '*']}` is a *role* wildcard for policy rows, and `defaults.ts` contains **zero** `role: '*'` rows | `backend/src/middleware/authorize.ts:20`, `backend/src/shared/rbac/engine.ts:81` |

**C8–C11 together mean: there is no existing door through which an ordinary portal user can read their own college's accent.** That is the design's central problem, solved in §4.

---

## 3. Approaches considered

### A. CSS custom properties + repointed Tailwind ramps — **chosen**

`tailwind.config.js`'s brand ramps become references to custom properties; `index.css` declares today's values as the `:root` default; a small module derives a new ramp from the accent and rewrites the properties.

The 2879 class occurrences keep their names and their meaning — `bg-primary-500` is still "the brand blue", it just resolves differently. **Edit surface: ~8 files. Blast radius: unchanged at ~300 files.** That inversion — large blast radius, tiny edit surface — is the whole argument for this approach, and success criterion 4 exists to prove it held.

### B. Pre-compiled theme bundles (ship N themes, switch a class)

Rejected. The accent is an arbitrary operator-supplied hex, not a choice from a fixed list; a bundle per possible value cannot exist.

### C. Rename every class to semantic tokens (`bg-brand`, `bg-surface`) first

Rejected. A 300-file rewrite that produces no user-visible benefit over A, and makes the diff unreviewable.

**Recommendation: A**, for the reason above.

---

## 4. Design

### 4.1 Where the accent comes from — **no new endpoint**

The constraint set (C8–C11) says every existing route to the accent is closed to an ordinary user. The tempting fix is a new `GET /api/colleges/current`. This spec does **not** add one, because a better door already exists: **`GET /auth/me` is already the session-bootstrap endpoint every logged-in user calls on every boot** (C7), it already returns `permissions` and `sensitivity` resolved for the caller, and it already receives `req.collegeId` — set by `authenticate` from the JWT, or from the `x-college-id` header that axios attaches to *every* portal request (`services/api.ts:26-33`).

Adding branding to it needs **no new route, no new permission, and no new RBAC question** — which matters, because C8 shows that picking a permission for a new endpoint would have forced a choice between exposing college branding to staff who are explicitly denied `platform`, or leaving those users unthemed.

`getMe(userId, collegeId?)` gains one field:

```ts
college: {
  id: string;
  name: string;
  code: string;
  logo?: string;
  accentColor: string | null;
} | null
```

- Resolved from `collegeId` (the `x-college-id` header / JWT claim for a regular user, the selected college for a superadmin).
- **`null`** when there is no resolvable college — a superadmin who has not yet picked one, or a dev-bypass session. The portal then keeps the legacy ramp.
- One `College.findById(collegeId).select('name code logo juvi accentColor').lean()` — consistent with the existing login path, which already imports the College model at `auth/service.ts:67`. A `findById` on `_id` is sub-millisecond; no cache in v1.

The **login** response is extended in the same two ways, so the first authenticated paint is themed without waiting for `/me`:
- non-superadmin: the same `college` block (`auth/service.ts:75`);
- superadmin: the existing `colleges[]` projection (`auth/service.ts:68-71`) gains `juvi.accentColor` and `logo`, so the selector can preview each college's brand.

> **Naming note.** `College.juvi.accentColor` sits inside the `juvi` sub-document because Juvi was its first consumer. The web portal is now its second, which makes the *name* slightly misleading — but the field is genuinely institution-level brand configuration, and renaming it would touch the mobile client, the Flutter-generated config model and the juvi-app config reader for no functional gain. **Decision: keep the name.** Cost if wrong: a cosmetic naming wart, reversible later by one migration.

### 4.2 How the portal applies it

Two units, deliberately split so the interesting part is pure and testable without a DOM.

**`admin-portal/src/lib/brand-ramp.ts` — pure, no DOM, no React.**

```ts
export interface BrandRamp {
  primary: Record<50|100|200|300|400|500|600|700|800|900, string>;  // 'R G B' triplets
  navy: { DEFAULT: string; dark: string; light: string };
}

export function isValidAccentHex(value: unknown): value is string;
export function resolveRamp(accentHex: string | null | undefined): BrandRamp;
export function readableOn(triplet: string): '#FFFFFF' | '#0F172A';
```

`resolveRamp` returns `LEGACY_RAMP` — the exact hexes from `tailwind.config.js:8-24`, frozen as a constant — whenever the accent is absent or malformed. Otherwise it derives.

**`admin-portal/src/lib/apply-ramp.ts` — the DOM adapter.**

```ts
export function applyRamp(ramp: BrandRamp): void;  // writes --c-* on document.documentElement
```

Tiny, jsdom-testable, and the only place that touches `document`.

**`admin-portal/src/components/BrandTheme.tsx`** — reads `collegeAccent` from the auth store and calls `applyRamp` in an effect. Mounted in `main.tsx`'s provider stack (which today is `ErrorBoundary > QueryClientProvider > BrowserRouter > (App, ConfirmDialog, Toaster)`), wrapping `<App />`.

**`admin-portal/src/stores/authStore.ts`** — gains `collegeAccent: string | null`, persisted to localStorage under `juvi.collegeAccent` alongside the existing keys (`collegeId`, `collegeName`, `colleges`). Populated in three places, all of which must change together:
- `hydrate()` — from the new `/auth/me` `college.accentColor` (the field-by-field mapper at `:144-156` is why C7 matters);
- `setAuth()` — from the login payload;
- `selectCollege()` — from the chosen entry in the superadmin's `colleges[]` — **this is what satisfies success criterion 3**, re-theming without a re-login.

### 4.3 The CSS-variable contract — the decision that makes or breaks this

The portal writes opacity modifiers constantly (C5). **A Tailwind colour declared as a plain `var(--x)` silently breaks `bg-primary-500/20`**, because Tailwind cannot inject an alpha channel into an opaque custom property. Today `bg-primary-600/10` and `bg-teal-500/20` are everywhere; getting this wrong turns a small change into a hunt through 260 files.

So the variables hold **space-separated sRGB channel triplets**, and the config composes them with Tailwind's alpha placeholder:

```css
/* index.css — the default is today's palette, verbatim */
:root {
  --c-primary-500: 43 108 176;   /* #2B6CB0 */
  --c-navy: 15 39 68;            /* #0F2744 */
  /* … */
}
```

```js
// tailwind.config.js
primary: { 500: 'rgb(var(--c-primary-500) / <alpha-value>)' },
navy:    { DEFAULT: 'rgb(var(--c-navy) / <alpha-value>)', /* … */ },
```

Every `bg-primary-500/20`, `hover:bg-primary-600/10` and `ring-primary-500/30` then keeps working unchanged. **This is a hard requirement of the design, not an implementation preference.**

`bg-app` and `teal`/`orange`/`accent` are left as literal hexes. `body`'s hardcoded `#F0F4F8` (`index.css:8`, which bypasses the `bg-app` token entirely) becomes `rgb(var(--c-bg-app))`, and the two scrollbar `rgba(26, 54, 93, …)` literals become variable references so they stop being a fixed navy against a themed chrome.

### 4.4 The derivation

Given a valid `#RRGGBB` accent:

1. Convert sRGB → HSL.
2. **Clamp hue untouched; clamp the 500-step lightness to `[0.32, 0.48]` and saturation to `[0.35, 0.75]`.** Without this, a near-white accent (`#FFEE00`) produces an illegible primary button — the clamp is what makes arbitrary operator input safe.
3. Steps 50→900 walk lightness down a fixed curve from ~0.97 to ~0.16, tapering saturation at both ends so the pale tints stay greyish rather than washed-out neon.
4. **`navy` reuses the accent's hue** at low saturation (≤ 0.35) and low lightness, preserving its role as dark chrome. A red accent therefore yields deep oxblood chrome rather than a fire-engine sidebar.
5. Label text on an accent fill is chosen by relative luminance — `readableOn` returns `#FFFFFF` or `#0F172A`.

The derivation is deterministic (same input → same output), which is asserted as a test.

### 4.5 Files touched

| File | Change |
|---|---|
| `backend/src/modules/auth/service.ts` | `getMe(userId, collegeId?)` + `college` block; login `college` block; superadmin `colleges[]` projection + `juvi.accentColor`/`logo` |
| `backend/src/modules/auth/controller.ts` | pass `req.collegeId` to `getMe` |
| `admin-portal/src/lib/brand-ramp.ts` | **new** — pure derivation |
| `admin-portal/src/lib/apply-ramp.ts` | **new** — DOM adapter |
| `admin-portal/src/components/BrandTheme.tsx` | **new** — reactive application |
| `admin-portal/src/main.tsx` | mount `BrandTheme` |
| `admin-portal/src/stores/authStore.ts` | `collegeAccent` + its three writers |
| `admin-portal/tailwind.config.js` | brand ramps → `rgb(var(--c-*) / <alpha-value>)` |
| `admin-portal/src/index.css` | `:root` defaults; `body` bg; scrollbar |
| the 6 files of C6 | literal hexes → variable references |

---

## 5. Testing

**`admin-portal/src/lib/__tests__/brand-ramp.test.ts`** (vitest, pure):
- `resolveRamp(null)` deep-equals `LEGACY_RAMP`, every value frozen from `tailwind.config.js` — *this is success criterion 1's proof*.
- `resolveRamp('not-a-colour')`, `resolveRamp('')`, `resolveRamp('#FFF')` → `LEGACY_RAMP`.
- `resolveRamp('#0B5FA5')` → hue within ±2° of the source; 500-step lightness inside `[0.32, 0.48]`; lightness strictly decreasing 50→900; every value a valid `R G B` triplet.
- Clamp behaviour: a near-white accent (`#FFEE00`) still yields a 500-step inside the legibility band.
- Determinism; `readableOn` both branches.

**`admin-portal/src/lib/__tests__/apply-ramp.test.ts`** (jsdom): the properties land on `document.documentElement`.

**Backend, `auth` tests:** `/me` carries `college.accentColor` for a regular user; `college` is `null` for a superadmin with no selection; superadmin `colleges[]` entries carry `accentColor`.

**E2E (Playwright, `e2e/`)** — one acceptance test: seed a college with an accent, log in, assert the computed `--c-primary-500` matches the derived value. This is the only test that proves the chain end-to-end; if the seed makes it awkward, it is the first thing to cut.

---

## 6. Decisions and alternatives

Each is settled with a default; each is overrulable at review.

| # | Decision | Alternative not taken |
|---|---|---|
| D1 | **Accent drives `primary-*` *and* `navy`** — full white-label, chrome included | **Accent drives `primary-*` only; navy/teal stay fixed.** See §7 — this is the one worth a second look |
| D2 | **No new endpoint**; branding rides `/auth/me` + login | A new `GET /api/colleges/current` mounted before the `superAdminOnly` gate (the `PATCH /:id/ai-spend-limits` precedent at `colleges/routes.ts:58-65`) — costs a permission decision for no gain |
| D3 | **Channel triplets + `<alpha-value>`** | Plain `var()` — breaks every opacity modifier |
| D4 | **Derivation is client-side and pure** | Server-side derivation — untestable without HTTP, and the server would be storing presentation policy |
| D5 | **Frozen legacy ramp when no accent is set** | Deriving the default from `#2B6CB0` too — would silently re-tint every existing install, failing criterion 1 |
| D6 | **Light-only** | Dark-mode parity — out of scope |
| D7 | **Keep the field named `College.juvi.accentColor`** | Rename to `College.brand.accentColor` — see §4.1 |
| D8 | **Login page keeps the Juvion brand** (pre-auth, no college known) | Reading the accent from localStorage before auth — theming a page with a credential the user has not presented |

---

## 7. Open for review

Two things I want challenged before this becomes a plan.

**7.1 — Does the accent belong on the chrome at all? (D1)**

The approved Foundation spec says, of the mobile app: *"`ColorScheme.fromSeed(seed: institution.accentColor)` with the accent applied only to primary actions and the College channel row; **surfaces and text stay neutral**."* The mobile deliberately does **not** tint its chrome.

The portal's analogue of "primary actions" is the `primary-*` ramp (buttons, links, active states); its analogue of "surfaces" is the navy sidebar. D1 tints both. That gives a self-hosted college a fully branded ERP — but it is **further than the parity argument strictly requires**, and a red-accented college gets oxblood chrome where the phone would have shown a neutral surface with red buttons.

I recommend D1 as written (a branded sidebar is the point of white-labelling an ERP, and the low-saturation cap in §4.4 step 4 keeps it from being garish), but the parity reading is defensible and cheaper. **If you prefer parity, say so and D1 flips to `primary-*`-only before the plan is written** — it is a one-line change to the ramp's scope, and expensive only if discovered after implementation.

**7.2 — Confirm the pre-auth surface (D8)**

The login page is the most-seen page in the product and keeps the Juvion brand under this design. Worth a conscious yes.

---

## 8. Unrelated defect found during discovery

`CLAUDE.md` lines **198** and **297** both assert that staff hold `platform:read` "via the staff-wide `*:read` fallback". **No such fallback exists.** `defaults.ts` contains zero `role: '*'` rows (verified by count); the `staff` base row is `{ module: 'people', action: 'read' }` (`:99`), and `{ module: 'platform', action: '*' }` is explicitly **denied** at `:101`. `engine.ts:81`'s wildcard is a *role* wildcard for policy rows, not an implicit grant.

The line-297 text is also load-bearing for a test decision — it is the stated justification for the e2e registrar persona. **Recorded here, not fixed in this workstream**, to keep the diff scoped; it should be its own one-line docs commit.

---

## Rulings

Recorded per the SDD discipline, since the review path was compressed.

- **Ruling: collapsed the brainstorming skill's section-by-section design approval into a single spec review.** — The four design defaults were stated conversationally and the user assented ("okay") before discovery completed; the user is unavailable and the skill's per-section cadence would have spent the session waiting. Writing the spec is explicitly permitted by conversational approval, and the HARD-GATE (spec approved → then plan) is intact. — *Cost if wrong:* the user reviews a document that assumes defaults they would have changed on the way; §6 and §7 exist to make each one cheap to overrule, and nothing has been implemented.
- **Ruling: skipped the visual companion offer.** — It is genuinely a visual subject, but the offer requires its own round-trip and the user is away; the spec carries exact hexes and an algorithm, both reviewable as text. §7.1 is the one place a mockup would help, and it is flagged as such. — *Cost if wrong:* the user approves a ramp they would have rejected on sight; recoverable in one iteration, since the ramp lives in a pure, tested module.
- **Ruling: excluded the three parked PR #109 follow-ups from this spec.** — The Dart `MeAcademics` handoff, the preview guard's missing `RBAC_ENFORCE='true'` case, and the ERP's hardcoded `75` are unrelated to theming and belong to the Flutter sub-project. — *Cost if wrong:* they stay parked, as already recorded.
