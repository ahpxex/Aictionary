#!/bin/sh
# Builds a signed and notarized macOS bundle locally, the same way CI does.
#
# Requirements on this machine:
#   - the "Developer ID Application" identity in the login keychain
#   - the App Store Connect API key at ~/.private_keys/AuthKey_<KEY_ID>.p8
#     (backup in 1Password: "Aictionary Notarization (App Store Connect API Key)")
#
#   scripts/release-macos.sh [--target aarch64-apple-darwin|x86_64-apple-darwin]
#
# The Tauri bundler picks the credentials up from the APPLE_* environment
# variables, signs the .app with the hardened runtime, submits it to the
# notary service, staples the ticket and then wraps it into the DMG.
set -eu

TEAM_ID="L7GVXT64TV"
KEY_ID="${APPLE_API_KEY:-TK2453646S}"
ISSUER="${APPLE_API_ISSUER:-31473101-3561-45de-a2b8-e86cbd71b378}"
KEY_PATH="${APPLE_API_KEY_PATH:-$HOME/.private_keys/AuthKey_$KEY_ID.p8}"
TARGET="aarch64-apple-darwin"

while [ $# -gt 0 ]; do
    case "$1" in
        --target) TARGET="$2"; shift 2 ;;
        -h|--help) sed -n '2,13p' "$0"; exit 0 ;;
        *) echo "unknown argument: $1" >&2; exit 2 ;;
    esac
done

if [ ! -f "$KEY_PATH" ]; then
    echo "notarization key not found: $KEY_PATH" >&2
    echo "restore it from 1Password, e.g.:" >&2
    echo "  op read 'op://Private/Aictionary Notarization (App Store Connect API Key)/private key' > $KEY_PATH" >&2
    exit 1
fi

IDENTITY=$(security find-identity -v -p codesigning \
    | grep "Developer ID Application" | grep "($TEAM_ID)" | head -n 1 \
    | sed -E 's/.*"(.*)"/\1/')
if [ -z "$IDENTITY" ]; then
    echo "no 'Developer ID Application' identity for team $TEAM_ID in the keychain" >&2
    exit 1
fi

cd "$(dirname "$0")/.."

echo "==> signing as: $IDENTITY"
APPLE_SIGNING_IDENTITY="$IDENTITY" \
APPLE_TEAM_ID="$TEAM_ID" \
APPLE_API_KEY="$KEY_ID" \
APPLE_API_ISSUER="$ISSUER" \
APPLE_API_KEY_PATH="$KEY_PATH" \
    bun tauri build --target "$TARGET" --bundles app,dmg

BUNDLE="src-tauri/target/$TARGET/release/bundle"
APP=$(find "$BUNDLE/macos" -maxdepth 1 -name '*.app' | head -n 1)

echo "==> verifying $APP"
codesign --verify --deep --strict --verbose=2 "$APP"
xcrun stapler validate "$APP"
spctl --assess --type exec --verbose=2 "$APP"
echo "==> ok. DMG: $(find "$BUNDLE/dmg" -maxdepth 1 -name '*.dmg' | head -n 1)"
