#!/usr/bin/env bash
# mobile/tool/gen_api.sh — regenerate packages/juvi_api from api/openapi.json.
# Requires Java 17+ and Node (npx). The generator version is pinned in openapitools.json.
set -euo pipefail
MOBILE="$(cd "$(dirname "$0")/.." && pwd)"
cd "$MOBILE"
rm -rf packages/juvi_api
npx --yes @openapitools/openapi-generator-cli generate \
  -i api/openapi.json \
  -g dart-dio \
  -o packages/juvi_api \
  --skip-validate-spec \
  --additional-properties=pubName=juvi_api,pubLibrary=juvi_api,pubVersion=1.0.0,pubDescription=Generated_Juvi_mobile_API_client,serializationLibrary=json_serializable
# The generator's default `environment.sdk` lower bound (2.17.0) makes json_serializable's
# generated code (null-aware map elements) fail to format under this package's effective
# language version. Bump the floor so codegen output parses on the pinned toolchain, and
# tighten the json_annotation constraint to match the version actually installed.
perl -pi -e "s/sdk: '>=2.17.0 <4.0.0'/sdk: '>=3.9.0 <4.0.0'/" packages/juvi_api/pubspec.yaml
perl -pi -e "s/json_annotation: '\^4.4.0'/json_annotation: '^4.12.0'/" packages/juvi_api/pubspec.yaml
cd packages/juvi_api
dart pub get
dart run build_runner build --delete-conflicting-outputs
cd "$MOBILE"
flutter pub get
echo "juvi_api regenerated"
