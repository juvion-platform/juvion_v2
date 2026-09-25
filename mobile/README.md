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

## Toolchain notes
- `riverpod_lint` / `custom_lint` are not installed: they require Dart >=3.13, and this toolchain pins Dart 3.12.2. Re-add them once the pinned Flutter/Dart version moves past that floor.
- `freezed` resolves to a `4.0.0-dev.x` prerelease for the same reason (`freezed` ^4.0.0 stable requires Dart >=3.13).
