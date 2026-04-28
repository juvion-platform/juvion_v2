# Frontend Tests — Foundation Layer (Completion Signal)

Initial unit-test pass for `admin-portal`. Vitest + @testing-library/react +
jsdom were already wired up by an earlier task; this batch adds the first
three component test files plus a small shared render helper.

## Files created

| Path | Purpose | Tests (focused / total) |
|---|---|---|
| `admin-portal/src/__tests__/test-utils.tsx` | `renderWithProviders` + `makeQueryClient` helper used by all component tests | n/a |
| `admin-portal/src/components/people/__tests__/PersonThumbnail.test.tsx` | Loading / photo / no-photo / error / broken-image branches of the per-row avatar | 0 / 9 |
| `admin-portal/src/components/people/__tests__/PersonPhotoBlock.test.tsx` | Permission gating + file-picker validation + confirm-upload + delete flow | 0 / 11 |
| `admin-portal/src/components/finance/__tests__/StudentFeeStructurePanel.test.tsx` | Loading / empty / happy-path / hold-banner / error / wiring branches | 0 / 7 |

(0 focused — none of the new tests are `.only` / skipped.)

## Suite-wide totals

- **4 files** total in admin-portal (Breadcrumbs already existed at 16/16).
- **43 / 43** passing — `npm test -w admin-portal` exits 0.
- **0 typecheck errors** — `npx tsc -b admin-portal` clean.
- **Build clean** — `npm run build -w admin-portal` produces dist/ without warnings (matches main branch baseline).

## Mock strategies

1. **Service modules — `vi.mock('../../../services/<module>')`** at the top of
   each test file, factory returning `vi.fn()` for every export the SUT
   imports. The mocked function is then re-imported and cast to `Mock` from
   vitest, and configured per test via `mockResolvedValue` / `mockRejectedValue`
   / `mockReturnValue(new Promise(() => {}))` for the never-resolving
   "loading-forever" case.
2. **Auth store — `vi.mock('../../../stores/authStore')`** in `PersonPhotoBlock.test.tsx`
   exporting a Zustand-shaped `useAuthStore<T>(selector)` whose `state.hasPermission`
   is a controllable `vi.fn()`. Tests reassign `mockHasPermission` in `beforeEach`
   and inside individual tests to flip between approver / read-only.
3. **React Query** — every render is wrapped in `QueryClientProvider` from the
   shared `renderWithProviders` helper, with `defaultOptions.queries.retry = false`
   to make the error-fallback tests deterministic (no retry storms) and the
   loading-forever tests fast.
4. **File-input simulation** — for the **valid** file path we use
   `userEvent.setup() + user.upload(input, file)` (v14 API). For the **invalid
   mime** path we fall back to `fireEvent.change(input, { target: { files: [...] }})`
   because `userEvent.upload` honours the `accept` attribute and silently
   filters the file before the component's own guard can run. (See spec gap below.)
5. **No CSS / no snapshots** — vitest config sets `css: false`; assertions key
   off ARIA roles, accessible names, and visible text rather than class strings.

## Spec gaps / observations

1. **`accept`-attribute vs. mime guard** — `PersonPhotoBlock` has a hidden
   `<input accept="image/jpeg,image/png,image/webp">`. RTL's `userEvent.upload`
   honours that filter, which means the component's own `ALLOWED_TYPES` guard
   only fires when the OS-level picker is bypassed (or when the user drags an
   image from a URL bar etc.). The redundancy is fine in production but the
   test had to use `fireEvent.change` instead of `userEvent.upload` to
   exercise it. Documented inline. **No fix required** — defense-in-depth is
   intentional.
2. **`PersonPhotoBlock` button visibility while a `pickerError` is pinned** —
   when the user picks an oversize / wrong-mime file, `pickerError` is set,
   which causes the entire `canEdit && !pickerError` button row to disappear
   (so Replace/Delete vanish even if a photo is on file). The "Try again"
   underline link inside the error message is the only remaining affordance.
   This is mildly surprising UX — maybe worth flagging — but it's existing
   behaviour and outside the scope of this task.
3. **No `data-testid` hooks anywhere in the SUTs.** Tests rely on accessible
   names, ARIA roles, and visible text. That's intentional and aligned with
   RTL philosophy, but it does mean a couple of assertions had to scope by
   `closest()` (e.g. distinguishing the `<h3>Fee Structure</h3>` heading from
   the FSI display-name fallback `"Fee Structure"`). Not a blocker but worth
   noting — if a future refactor renames the heading, that scoped query will
   need updating.
4. **`useAuthStore` selector signature** — the real Zustand store accepts
   `useAuthStore(selector)` with implicit return-type inference. The mock
   replicates that with a generic `<T>(selector) => T`. If Zustand 6+ ever
   ships an exotic overload (e.g. `useAuthStore.getState()`), the mock would
   need an `Object.assign` to expose `.getState`. Not used by either SUT
   today.
5. **No coverage of the actual upload progress bar / toast surface.** The
   spec said "don't assert the toast — just the mutation call", and we
   followed that. If we want to test the success-toast lifecycle later it
   will need a way to advance the 3500ms `setTimeout` (likely `vi.useFakeTimers()`
   + `vi.advanceTimersByTime`).
6. **Counter / aggregation calculation** — `StudentFeeStructurePanel.test.tsx`
   exercises the totals computation indirectly (via the rendered ₹54,000 /
   ₹6,000 numbers). A pure-function extraction of the totals reducer would be
   easier to unit-test in isolation; deferred.

## Verification commands

```bash
npm test -w admin-portal             # 43 / 43 pass
npx tsc -b admin-portal              # 0 errors
npm run build -w admin-portal        # clean
```
