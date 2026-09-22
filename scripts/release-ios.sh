#!/usr/bin/env bash
set -euo pipefail

if [[ ! "${1:-}" =~ ^[1-9][0-9]*$ ]] || [[ $# -gt 2 ]] || [[ -n "${2:-}" && "$2" != --upload ]]; then
  echo "Usage: $0 BUILD_NUMBER [--upload]" >&2
  exit 1
fi

cd "$(dirname "$0")/.."
project_dir="$PWD/src-tauri/gen/apple"
archive_path="$project_dir/build/aictionary-re_iOS.xcarchive"
export_path="$project_dir/build/app-store"

# The signing identity and matching profile must already be installed.
# XcodeGen must not copy Externals/*.a into the application's resources.
xcodegen generate --spec "$project_dir/project.yml"
env -u http_proxy -u https_proxy -u all_proxy -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY \
  bun tauri ios build --ci --archive-only --export-method app-store-connect --build-number "$1"

export http_proxy=http://127.0.0.1:7890
export https_proxy=http://127.0.0.1:7890
export no_proxy=localhost,127.0.0.1,::1
xcodebuild -exportArchive -archivePath "$archive_path" -exportPath "$export_path" \
  -exportOptionsPlist "$PWD/src-tauri/ios-export-options.plist"

if [[ "${2:-}" == --upload ]]; then
  # Keep the existing App Store Connect team key in 1Password. Never echo it
  # or persist it in the checkout, build artifacts, or CI logs.
  umask 077
  key_dir=$(mktemp -d "${TMPDIR:-/tmp}/aictionary-asc.XXXXXX")
  trap 'rm -rf "$key_dir"' EXIT
  op read 'op://Private/RA App store stuff/AuthKey_LBWK93782R.p8' --out-file "$key_dir/key.p8"
  api_key=$(op read 'op://Private/RA App store stuff/key id')
  api_issuer=$(op read 'op://Private/RA App store stuff/issuer id')
  xcrun altool --upload-app --type ios --file "$export_path/Aictionary.ipa" \
    --apiKey "$api_key" --apiIssuer "$api_issuer" --p8-file-path "$key_dir/key.p8"
fi
