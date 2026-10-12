# Mobile institution theming — Design

**Status:** Draft for review (GATE 1)
**Date:** 2026-10-12
**Related:** `docs/superpowers/specs/2026-10-09-portal-institution-theming-design.md` (the portal half, on `main` as `5d3bf1e`), `docs/superpowers/specs/2026-09-23-juvi-foundation-design.md` § Look and feel (`:819-823`)

---

## 1. Purpose

An institution's brand colour reaches the browser and the phone by two different routes that
disagree.

- **The web portal** derives its palette from the accent. `admin-portal/src/lib/brand-ramp.ts`
  converts the accent's sRGB to HSL, walks a fixed lightness ladder across steps 50–900, clamps the
  500 step into a legibility band, applies a relative-luminance ceiling above it, and derives a
  separate low-chroma `navy`. It writes the result to CSS custom properties, so all 2879
  `primary-*`/`navy` class names resolve through it.
- **The mobile app** does one line of Material: `ColorScheme.fromSeed(seedColor: accent ?? kDefaultAccent)`
  (`mobile/lib/app/theme.dart:7`).

Material 3's HCT tonal-palette generator is a **different algorithm** from the portal's ladder, so
the same institution renders as two different brands. The divergence is not subtle and it is not
only about hexes:

| | Portal (`brand-ramp.ts`) | Mobile (`ColorScheme.fromSeed`) |
|---|---|---|
| `#0B5FA5`, the seeded demo accent (lightness 0.345) | clamped **up** into `[0.44, 0.58]` → a lighter, more vivid blue | tone selected by HCT; not clamped to any band |
| **No accent set** | `LEGACY_RAMP` — old Juvion `#2B6CB0` | `kDefaultAccent` `#0B5FA5` |

The second row is the louder failure: two installs that have set nothing at all already look
different on the two surfaces.

**Goal:** the phone renders **the same hexes as the browser** for a given institution accent. One
derivation, two renderings.

**Intended outcome (the design brief):** an operator sets an accent once on `/platform/juvi →
Settings` and the phone and the browser show that college's brand. The phone needs no rebuild — it
already reads `College.juvi.accentColor` through `GET /api/juvi-app/v1/config` on start and daily
(`mobile/lib/core/models/models.dart:114`, `:41`).

### Success criteria

1. **Same input, same output.** For every accent, the mobile's 10 primary steps equal the portal's
   `resolveRamp(...).primary`, triplet for triplet. Asserted against a shared golden fixture, not by
   eye.
2. **No accent → the legacy palette, on both surfaces.** `resolveRamp(null)` on mobile returns the
   palette frozen from the portal's `LEGACY_RAMP`, matching the browser's no-accent rendering.
3. **The brand roles are the only repointed ones.** No `error*`, `surface*`, `onSurface*` or
   `outline*` role is set from the ramp — each remains whatever `fromSeed` produces for the resolved
   seed, which is today's behaviour. Asserted for both brightnesses.
4. **Nothing else changes.** Of the 2 literal colours in `mobile/lib`, the scaffold colour is kept
   verbatim and `kDefaultAccent` is deleted (§4.6); the text, card and button themes are untouched;
   `git diff --stat` shows no change to any feature widget.
5. `flutter analyze` clean; `flutter test` and `npm test -w admin-portal` green;
   `npm run typecheck` 0 errors.

### Non-goals (YAGNI)

- **No tinted chrome.** The app bar, navigation and card surfaces stay neutral. The mobile
  Foundation spec is explicit — *"the accent applied only to primary actions and the College channel
  row; **surfaces and text stay neutral**"* (`2026-09-23-juvi-foundation-design.md:821-823`) — and
  the portal's own D1 (branded sidebar) has no mobile analogue, because the mobile has no sidebar.
- **No change to the accent's source or transport.** No new endpoint, no config-payload change, no
  backend change. The accent already arrives on mobile.
- **No error/warning re-hue.** `error` stays Material red. The portal freezes `teal`/`orange` for
  the same reason: they are semantic, not brand.
- **No pre-auth theming.** Sign-in and onboarding render under the default palette (the legacy ramp)
  until the config resolves, mirroring the portal's D8 ("the login page keeps the Juvion brand").
  The institution-code field resolving a college *before* sign-in
  (`mobile/lib/features/auth/institution_code_field.dart`) is a real opportunity and is left as a
  separate question — it is not reached by `appConfigProvider`.
- **No new settings surface.** `ThemeMode` keeps its existing device-level preference
  (`mobile/lib/features/me/theme_preference.dart`, persisted at `juvi.theme_mode`).

---

## 2. Constraints discovered

Each verified against the code, not assumed.

| # | Constraint | Evidence |
|---|---|---|
| C1 | Mobile builds its scheme from `ColorScheme.fromSeed` over the accent, in both brightnesses, from one `accent` value | `mobile/lib/app/theme.dart:6-8`; `mobile/lib/app/app.dart:22-23` |
| C2 | The accent reaches mobile as a **string** on the config payload; `app.dart` parses it with `parseHexColor` before handing `buildTheme` a `Color` | `app.dart:16`; `theme.dart:27-30` |
| C3 | `parseHexColor`'s regex is byte-identical to the portal's `isValidAccentHex` | `theme.dart:28` vs `brand-ramp.ts:48` — both `/^#[0-9a-fA-F]{6}$/` |
| C4 | The mobile's colour surface is **small**: 2 literal colours exist in all of `mobile/lib`, both in `theme.dart` | measured: `Color(0x` occurrences outside generated files = 2 (`theme.dart:3`, `:11`) |
| C5 | The roles the app consumes explicitly are only ~9, of which **3 carry the brand** | measured — see §4.3 |
| C6 | `buildTheme` is called by **4 test files**; **2** of them pass an accent, as a `Color` | `test/features/notices/host.dart:21` (no accent), `test/features/system/system_screens_golden_test.dart:22` (no accent), `test/features/notifications/permission_card_golden_test.dart:15`, `test/shared/empty_state_golden_test.dart:14` |
| C7 | There are **no theme tests on mobile today** | `mobile/test/app/` holds no theme test; `buildTheme` is exercised only as golden scaffolding |
| C8 | Golden tests are excluded from CI but **still compiled** by `flutter analyze` | `.github/workflows/mobile.yml:36,39` (`flutter analyze`; `flutter test --exclude-tags golden --coverage`, `working-directory: mobile`) |
| C9 | The portal's derivation is pure, exported, and already pinned by a 9.7 KB test suite | `admin-portal/src/lib/brand-ramp.ts:184-219`; `__tests__/brand-ramp.test.ts` |
| C10 | The portal's brand **fill** is step 600, not 500 — 500 is a nominal token, not the button | measured: `bg-primary-600` ×615, `bg-primary-700` ×604 (hover), `bg-primary-500` ×4 |
| C11 | The portal's most-used brand **text** step is 700 | measured: `text-primary-700` ×166, `text-primary-500` ×119, `text-primary-600` ×83 |
| C12 | There is **no shared TypeScript package** between `backend/` and `admin-portal/` | repo root holds only `admin-portal/ backend/ docs/ e2e/ graft/ mobile/ scripts/`; `shared/` exists only as `backend/src/shared/` |

C12 is why §3 rejects the obvious "compute it once on the server" answer.

---

## 3. Approaches considered

### A. Port the derivation to Dart, pinned by a shared golden fixture — **chosen**

`mobile/lib/app/brand_ramp.dart` is a faithful mirror of `brand-ramp.ts`, and a checked-in
`accent → triplets` table — generated from the TypeScript, asserted by **both** suites — is the
contract between them. Change the reference implementation without regenerating the table and the
portal suite reddens; change the port and the Flutter suite reddens.

Cost: the algorithm exists twice. Mitigated by the fixture being a two-way contract, which is the
pattern this repo already uses for the import templates (`CLAUDE.md`, "Student bulk import" — *"Two-way
contract — change one side and template files stop importing"*).

**Why it is right here**, beyond the cost: the accent reaches the phone asynchronously and the
config is cached for offline use, so the phone must be able to derive its palette with no network
at all. Client-side derivation is not a preference on mobile; it is a requirement.

### B. Serve the computed ramp in the config payload

One implementation, structurally impossible to drift. Rejected on three counts:

1. **C12** — there is no shared TS package, so the backend would need its own copy of the algorithm,
   which duplicates TypeScript instead of Dart and makes the drift *worse* (the portal and the
   server would be the two copies, and the portal is the one with the test suite).
2. It contradicts the portal spec's D4 (*"derivation is client-side and pure"*) and would move
   presentation policy into the server.
3. It changes the API surface, the generated Dart client and the offline cache path — for no
   functional gain over A.

### C. Generate the Dart from the TypeScript

Rejected. A codegen step and its build wiring, to maintain 200 lines that change approximately
never. The golden fixture in A already buys the one thing codegen would — a mechanical guarantee
that the two agree.

**Recommendation: A.**

---

## 4. Design

### 4.1 The Dart port — `mobile/lib/app/brand_ramp.dart`

A faithful port of `admin-portal/src/lib/brand-ramp.ts`, same constants, same order of operations:

```dart
/// 'R G B', each channel 0-255 — the portal's own triplet format, kept verbatim so
/// the golden fixture can be compared without normalising.
typedef Triplet = String;

class BrandRamp {
  const BrandRamp(this.primary);
  /// Keyed 50, 100, … 900.
  final Map<int, Triplet> primary;
  Color color(int step);           // triplet -> Color, for the theme layer
}

/// The palette the app shipped with, frozen from the portal's LEGACY_RAMP.primary.
const BrandRamp kLegacyRamp = …

/// Mirrors resolveRamp() in admin-portal/src/lib/brand-ramp.ts. Returns kLegacyRamp
/// for an absent, malformed or hostile accent; never throws.
BrandRamp resolveRamp(String? accentHex);

/// The same predicate as the portal's isValidAccentHex / the existing parseHexColor.
bool isValidAccentHex(String? value);
```

Ported verbatim: `L_LADDER`, `S_SCALE`, `L500_MIN`/`L500_MAX` `0.44`/`0.58`, `S500_MIN`/`S500_MAX`,
`LUM_CEILING` `[0.170, 0.130, 0.080, 0.045, 0.024]`, `ACHROMATIC_S` `0.04`, the 32-iteration binary
search in `capLuminance`, and `clamp(s500 * S_SCALE[i], achromatic ? 0 : 0.02, 0.95)`.

`parseHexColor` is **deleted**, not moved: after the rewire its only caller (`app.dart:16`) passes
the raw string through instead, so keeping it would ship a second, unused hex parser next to the
port's own. Its regex lives on as the port's `isValidAccentHex` — one predicate, one parse.

**Porting hazards, each checked rather than assumed:**

| Hazard | Verdict |
|---|---|
| JS `Math.round` rounds half **up**; Dart `.round()` rounds half **away from zero** | Identical for non-negative values, and `hslToRgb`'s `m = l - c/2` is non-negative across the whole ladder (`l ≥ 0.16` vs `c/2 ≤ 0.16`), so no half-way case is reachable with a negative sign. Safe. |
| `parseInt(hex.slice(1,3), 16)` vs `int.parse(hex.substring(1,3), radix: 16)` | Equivalent — the regex admits exactly six hex digits, so no sign, whitespace or `0x` prefix can reach either. |
| Dart `double` vs JS `number` | Both IEEE-754 binary64; `Math.pow`, `/` and `%` agree. |
| JS `%` on negatives vs Dart `%` | Guarded identically on both sides by `(((h % 360) + 360) % 360)`. |

### 4.2 Theme wiring — `mobile/lib/app/theme.dart`

Material still fills the scheme; only the brand-bearing roles are repointed. This is deliberately
the portal's own move — it repointed 2879 class names to variables and left the rest of Tailwind
alone — and it means no obscure role can be left unpopulated, because `fromSeed` populated it.

```dart
ThemeData buildTheme({required Brightness brightness, String? accentHex}) {
  final ramp = resolveRamp(accentHex);
  final seed = ramp.color(600);
  final base = ColorScheme.fromSeed(seedColor: seed, brightness: brightness);
  final scheme = base.copyWith(
    primary: ramp.color(600), onPrimary: const Color(0xFFFFFFFF),
    primaryContainer: ramp.color(100), onPrimaryContainer: ramp.color(900),
    tertiary: ramp.color(700),
    // …dark-mode values from §4.3…
  );
  …
}
```

- `parseHexColor` leaves `theme.dart`; `app.dart:16` passes the raw config string straight
  through, so the parse-and-validate path is the port's, exactly as on the portal.
- **The seed is `ramp.color(600)`, and it stays load-bearing even though `primary` is overridden.**
  `fromSeed` derives `secondary` and the neutral surface tints from it, so those move with the seed.
  For an accent-set college the seed is the accent, as today; for no accent it moves from `#0B5FA5`
  to the legacy ramp's `#2563A0` — the same tone ladder at a hue two degrees away, so the surface
  tints shift imperceptibly rather than identically. This is why criterion 3 is worded as "still
  `fromSeed`-derived" rather than "byte-identical". `error` is not seed-derived at all, and §5 pins
  it in a test rather than asserting it here.
- 5 of the 6 lines of `theme.dart`'s current `copyWith` block (scaffold colour, text theme, card,
  button themes, list tiles) are **unchanged**. The scaffold literals stay as they are; you chose
  neutral surfaces and the spec requires them.

### 4.3 The role mapping

Grounded in what the app actually consumes (C5) and in what the portal actually paints (C10, C11) —
not in Material's naming.

| Role | Light | Dark | Grounding |
|---|---|---|---|
| `primary` | ramp **600** | ramp **300** | The portal's real button fill is 600 (615 uses), hovering to 700 (604). 500 appears 4 times — it is a nominal token, not the button. Dark takes a light-end step, per M3's dark convention. |
| `onPrimary` | `#FFFFFF` | ramp **900** | The portal's luminance ceiling exists precisely to let white sit on an accent fill; it is what makes this safe for arbitrary operator input. |
| `primaryContainer` | ramp **100** | ramp **800** | The portal's soft-chip tint. Consumed at `ack_control.dart:128` and `channel_row.dart:26`. Dark pairs a dark container with light content, as M3 specifies. |
| `onPrimaryContainer` | ramp **900** | ramp **100** | Content on that tint — `ack_control.dart:141,154,156`. |
| `tertiary` | ramp **700** | ramp **300** | Exactly one use, `sign_in_screen.dart:99`. 700 is the portal's most-used brand text step (166), so the family is consistent with the browser. |
| `error`, `onError`, `errorContainer`, `onErrorContainer` | unchanged | unchanged | Semantic, and consumed in 12 places across 8 files. The portal freezes `teal`/`orange` on the same reasoning. |
| `surface*`, `onSurface*`, `outline*` | unchanged | unchanged | Non-goal (spec §11). `surfaceContainerHighest` (skeletons, detail blocks) and `outlineVariant` (card borders, onboarding dots) stay neutral. |

**Why the mapping is legible, not merely plausible.** The steps chosen are the ones the portal's own
guarantees cover. For a *derived* ramp the two clamps bound steps 500–900; for the *legacy* ramp the
values are hand-tuned and happen to satisfy the same ceilings. Computed contrast ratios:

| Pair | Legacy light | Ratio | Derived worst case |
|---|---|---|---|
| `onPrimary` on `primary` | white on `#2563A0` | **6.2:1** | ≥ 5.8:1 (600's ceiling is 0.130) |
| `onPrimaryContainer` on `primaryContainer` | `#0F2744` on `#DBEAFE` | **11.9:1** | ≥ 11:1 (100 is a tint, 900 has no ceiling but is dark by ladder) |
| `tertiary` as text on white | `#1E4F82` | **8.1:1** | ≥ 8.1:1 (700's ceiling is 0.080) |
| Dark `onPrimary` on `primary` | `#0F2744` on `#7BAED4` | **6.0:1** | ≥ 6:1 (300 is a light tint, 900 dark) |

All clear AA for normal text (4.5:1). This is the reason the mapping is expressed in **ramp steps**
rather than raw hexes: any step substituted from another position on the ladder loses its guarantee.

### 4.4 No accent → the legacy ramp

`resolveRamp(null)` returns `kLegacyRamp`, frozen from the portal's `LEGACY_RAMP.primary`, and the
theme seeds and repoints from it. This satisfies success criterion 2 and **is a visible change**:

- today, no accent seeds Material from `#0B5FA5` (`kDefaultAccent`) and lets HCT choose the palette;
- after, no accent renders the portal's legacy palette — `primary` becomes `#2563A0`, the tints and
  shades become the old Juvion ramp.

This is the one place where "match the portal" makes the phone *differ* from how it looks today for
an institution that has set nothing. It is the correct reading of the requirement — the browser's
no-accent rendering is the legacy palette — but it is called out here so it is a decision rather
than a surprise.

`kDefaultAccent` is deleted. The seed is always a value off the resolved ramp, so no second
default exists to drift from it.

The change has two parts, and only the first is the one described above: the ten primary steps and
`tertiary` are repointed from the legacy ramp (**the intended change**), and the seed-derived
neutral tints move with the seed by an amount below perception (§4.2). Everything a user would
call "the brand colour" is the first part.

### 4.5 What is deliberately **not** ported

`navy` and `chrome` from `BrandRamp`. Nothing on the phone consumes them: there is no sidebar, and
no `teal` appears anywhere in `mobile/lib`. Porting them would ship two tested-but-unconsumed fields
— the precise finding the portal's own review raised about `readableOn`, which was removed for it.
The port covers the 10 `primary` steps, which is every value the phone reads.

Consequently the fixture in §5 covers `primary` only. If a future mobile surface wants the navy
chrome, it ports those three lines and the fixture grows — the algorithm is already there.

### 4.6 Files touched

| File | Change |
|---|---|
| `mobile/lib/app/brand_ramp.dart` | **new** — the port: `kLegacyRamp`, `resolveRamp`, `isValidAccentHex` |
| `mobile/lib/app/theme.dart` | `buildTheme` takes `String? accentHex`; builds the scheme via `fromSeed(...).copyWith(brand roles)`; `kDefaultAccent` and `parseHexColor` both removed |
| `mobile/lib/app/app.dart` | `:16` passes the raw accent string instead of parsing it |
| `mobile/test/app/brand_ramp_test.dart` | **new** — port behaviour + golden-fixture parity |
| `mobile/test/app/theme_test.dart` | **new** — the role mapping, both brightnesses, both with and without an accent |
| the 2 test files of C6 that pass an accent | `accent: const Color(0xFF0B5FA5)` → `accentHex: '#0B5FA5'`. The other 2 name no accent and need no edit. |
| `admin-portal/src/lib/brand-ramp.golden.json` | **new** — the fixture, beside the implementation that owns it |
| `admin-portal/src/lib/__tests__/brand-ramp.golden.test.ts` | **new** — asserts the fixture against `resolveRamp`, regenerating under `UPDATE_GOLDEN=1` |

No feature widget, model, service, endpoint or generated file changes.

---

## 5. Testing

**The golden fixture — the contract.** `accent → primary triplets`, checked in beside
`brand-ramp.ts`. Accents: the seeded demo accent `#0B5FA5` plus the sweep `brand-ramp.test.ts`
already uses (near-white `#FFEE00`, the primaries, an achromatic `#7F8080`, a dark accent) so the
clamps and the luminance ceiling are all exercised, not just a comfortable mid-blue.

- `admin-portal/src/lib/__tests__/brand-ramp.golden.test.ts` — for every row,
  `expect(resolveRamp(row.accent).primary).toEqual(row.primary)`. Run with `UPDATE_GOLDEN=1` it
  rewrites the file instead, which is the documented way to accept an intentional algorithm change.
- `mobile/test/app/brand_ramp_test.dart` — reads the **same file** across the tree (Flutter tests
  run with `mobile/` as the working directory, so `../admin-portal/src/lib/brand-ramp.golden.json`)
  and asserts each row triplet-for-triplet. This is success criterion 1's proof.
  **It must fail loudly if the file is missing, never skip.** A drift guard that quietly skips when
  its input is absent is a vacuous test — the failure mode already caught once in this codebase,
  where a "Cancel clears it" assertion passed only because the refetch rewrote the state before it
  was read.

**`mobile/test/app/brand_ramp_test.dart`, beyond the fixture:**

- `resolveRamp(null)`, `resolveRamp('')`, `resolveRamp('not-a-colour')`, `resolveRamp('#FFF')`
  all return `kLegacyRamp` — success criterion 2.
- **The legacy ramp equals the portal's frozen values**, each asserted by name, so a change to
  either side's constant is caught here too.
- Determinism: the same accent twice gives an identical ramp.
- Lightness decreases monotonically 50 → 900 for every fixture accent.
- Every value parses as a valid `R G B` triplet.
- A neutral accent (`#7F8080`) stays neutral rather than acquiring a saturated identity at hue 0 —
  the `ACHROMATIC_S` guard, ported.

**`mobile/test/app/theme_test.dart`:**

- With no accent: `primary` == legacy 600, `onPrimary` == white, `primaryContainer` == legacy 100,
  `tertiary` == legacy 700 — in **both** brightnesses (with the dark values from §4.3).
- With `#0B5FA5`: `primary` == `resolveRamp('#0B5FA5').color(600)`.
- **The neutrality guarantee, asserted rather than assumed:** for both brightnesses and both the
  accent and no-accent cases, `error`, `surface`, `onSurface`, `onSurfaceVariant` and `outlineVariant`
  equal what `ColorScheme.fromSeed` alone produced — success criterion 3. Without this the
  `copyWith` could quietly widen and nothing would notice.
- The repointed steps are distinct from one another (`primary != primaryContainer`) for a
  desaturated accent, so the AC control's container does not vanish into its own fill.

**Existing suites:** `flutter analyze` clean (it compiles the golden tests even though CI skips
running them); `flutter test --exclude-tags golden` green; `npm test -w admin-portal` green;
`npm run typecheck` 0 errors.

**Golden images:** all **4** golden tests of C6 need regenerating, not just the 2 that pass an
accent — the other 2 render with no accent, and the no-accent palette is exactly what §4.4 changes.
A local, tag-excluded concern (C8), recorded so it is not mistaken for a regression.

---

## 6. Decisions

Each settled with a default; each overrulable at review.

| # | Decision | Alternative not taken |
|---|---|---|
| D1 | **Port the derivation; keep two implementations under a shared golden contract** | Serve the ramp from the backend — see §3 B |
| D2 | **`primary` is ramp 600, not 500** | 500, "the brand token" — measured to be 4 fill uses against 600's 615 |
| D3 | **`fromSeed(...).copyWith(...)`** — Material fills all roles, the brand ones are repointed | Hand-constructing `ColorScheme` — every obscure role becomes a way to crash a component |
| D4 | **Dark derives from the ramp's light end** on the existing neutral dark surfaces | Keeping `fromSeed` for dark; or seeding dark from the raw accent |
| D5 | **No accent adopts the portal's legacy ramp** | Keeping `#0B5FA5` as a mobile-only default — would leave criterion 2 unmet |
| D6 | **`error` and all neutrals stay put** | Re-hueing them from the ramp — the portal froze its semantic ramps for the same reason |
| D7 | **`navy`/`chrome` are not ported** | Porting the whole `BrandRamp` shape — ships two unconsumed fields |
| D8 | **`parseHexColor` is deleted**, its validation living on as the port's `isValidAccentHex` | Moving it into the port — with `app.dart` no longer calling it, that ships a dead second parser |
| D9 | **Pre-auth screens keep the default palette** | Reading the accent from the config cache before it resolves — theming a screen from data the app has not fetched yet |

---

## 7. Open for review

**7.1 — The dark-mode indices are mine, not the portal's.** The portal is light-only (its D6), so
there is no precedent to copy for the dark columns of §4.3. I have followed Material 3's dark
convention — light-end steps for `primary`, dark-end for containers — and checked the resulting
contrast ratios, but two choices are judgement calls worth a look: `primary` at **300** rather than
200 (more brand identity, slightly less contrast) and `onPrimaryContainer` at **100**, which is one
step lighter than the "200–400" band I described when we agreed this. The rule you approved is what
is implemented; these are its indices.

**7.2 — Is the no-accent change (§4.4) wanted?** An institution that has set no accent sees its
phone change colour. That is what parity *means* here — the browser shows the legacy palette — but
it is the one user-visible regression-shaped change in this design, and it is cheap to reverse
(keep `#0B5FA5` as the no-accent seed, at the cost of criterion 2). Worth a conscious yes.

**7.3 — Should `tertiary` carry the brand at all?** Its single use is the sign-in "why can't I get
in" line (`sign_in_screen.dart:99`), which is arguably informational rather than brand. Mapping it
to ramp 700 makes it accent-family; leaving it on Material's derived tertiary would keep it distinct
from the buttons. I recommend ramp 700 for consistency with the portal's most-used text step, but
it is a one-line change either way.

---

## 8. Rulings

Recorded per the SDD discipline.

- **Ruling: collapsed the brainstorming skill's per-section design approval into the two questions
  actually asked (parity depth; dark mode), then one design presentation, then this spec.** — The
  two forks that change the shape of the work were put to the user and answered; everything
  downstream is mechanical and is enumerated in §4.3 and §6 so each item is cheap to overrule. The
  HARD-GATE (spec approved → then plan) is intact. — *Cost if wrong:* the user reviews a document
  assuming details they would have changed on the way; §7 exists to surface the three that are
  genuinely contestable.
- **Ruling: skipped the visual companion offer, again.** — This is a colour subject and a mockup
  would help, but the user is present and terse, and the design is expressible as exact steps plus
  computed contrast ratios, both reviewable as text. §7.1 is the one place a rendered comparison
  would settle it faster than prose. — *Cost if wrong:* an approved mapping that the user would have
  rejected on sight; recoverable in one file, and pinned by the theme test so the change is
  mechanical.
- **Ruling: excluded the three parked PR #109 follow-ups (generated Dart `getMeAcademics`, the
  preview guard's `RBAC_ENFORCE` case, the hardcoded `75`) and the PR #111 attention-`kind` fixtures
  from this spec.** — Unrelated to theming; they keep their existing owners. — *Cost if wrong:* they
  stay parked, as already recorded.
- **Ruling: the golden fixture lives in `admin-portal/src/lib/` rather than a new root-level shared
  directory.** — The fixture pins the portal's implementation, so it belongs beside it; a root
  `shared/` would be a new top-level concept for one JSON file, and C12 shows none exists. The
  mobile test reaches across the tree, which is explicit and testable. — *Cost if wrong:* a
  cross-workspace path in one Dart test, relocated by moving one file.
