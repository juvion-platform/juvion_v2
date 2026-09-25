# Juvi mobile app

Flutter client for the Juvion ERP's student and faculty network. Spec: `docs/superpowers/specs/2026-09-23-juvi-foundation-design.md`.

## Run against a local backend
1. `npm run dev:backend` at the repo root (API on :3003) and `npm run seed -w backend` once — the seed prints demo credentials.
2. `flutter run --dart-define=JUVI_API_BASE_URL=http://10.0.2.2:3003/api/juvi-app/v1` (Android emulator) or `http://localhost:3003/...` (iOS simulator).
3. Institution code `JIT`, the printed roll number or employee code, temporary password `river-lamp-482`.

## Regenerate the API client
`./tool/gen_api.sh` after `npm run openapi:mobile -w backend`. CI fails if the committed package differs.

## Codegen
`dart run build_runner build --delete-conflicting-outputs` (riverpod, freezed, drift) and `flutter gen-l10n` after editing ARB files.

## Golden tests
Golden images are platform-sensitive (macOS renders differ from Linux CI), so every golden test file is tagged `@Tags(['golden'])` and CI runs `flutter test --exclude-tags golden --coverage`. Generate/update goldens locally with `flutter test --tags golden` (add `--update-goldens` to refresh the committed PNGs).

## Tests
- `flutter test` — unit, widget and golden tests (`flutter test --update-goldens` after an intentional visual change).
- `flutter test test/flows` — the sign-in → onboarding → Today flow against a mocked API.
- `flutter test integration_test` — the same flow on a connected device or emulator.

## Toolchain notes
- `riverpod_lint` / `custom_lint` are not installed: they require Dart >=3.13, and this toolchain pins Dart 3.12.2. Re-add them once the pinned Flutter/Dart version moves past that floor.
- `freezed` resolves to a `4.0.0-dev.x` prerelease for the same reason (`freezed` ^4.0.0 stable requires Dart >=3.13).
- The generated client (`dart-dio` 7.10.0) casts nullable-object fields (`type: ["object", "null"]` in the contract, e.g. `Me.student`/`Me.faculty`, `Config.minAppVersion`, `Config.supportContact`, `InstitutionLookup.minAppVersion`) to a non-nullable `Map`, so it throws on every real payload where one of those is actually `null` — which, for `minAppVersion`/`supportContact`, is the common case (no app-version gate, no support contact configured), not an edge case. A contract sweep (2026-09) found exactly four call sites affected, and each reads a raw `Dio` instead of going through `MobileApi` to route around it: `lib/core/repos/me_repository.dart` (`/me`, and the `/me/photo` upload body — a separate generator gap, not a nullable-object one), `lib/core/repos/auth_repository.dart`'s `lookupInstitution` (`/institutions/{code}`, on the new unauthenticated `bareDioProvider`) and `fetchAccount` (`/me`), and `lib/core/repos/config_repository.dart`'s `refresh` (`/config`). No other endpoint is affected. **When mocking any of these four, send the field as a real `null`** (as the contract and the real server do) — never a placeholder object; a mock that can't reproduce `null` here can't catch a regression back onto the generated client (R61).
