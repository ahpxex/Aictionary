#!/bin/sh
# One-time (per machine) setup of the notarization credentials that
# scripts/release-macos.sh uses. Stores them in the login keychain under
# the notarytool profile "aictionary-notary" (override: AICTIONARY_NOTARY_PROFILE).
#
# The credentials are an App Store Connect API key with the Developer role,
# created under App Store Connect → Users and Access → Integrations →
# Team Keys. The .p8 can only be downloaded once; the backup lives in
# 1Password as "Aictionary Notarization (App Store Connect API Key)".
#
#   scripts/notary-setup.sh --key ~/.private_keys/AuthKey_XXXXXXXXXX.p8 \
#       --key-id XXXXXXXXXX --issuer <issuer-uuid>
#
# Verify afterwards: xcrun notarytool history --keychain-profile aictionary-notary
set -eu

PROFILE="${AICTIONARY_NOTARY_PROFILE:-aictionary-notary}"

KEY="" KEY_ID="" ISSUER=""
while [ $# -gt 0 ]; do
    case "$1" in
        --key)    KEY="$2"; shift 2 ;;
        --key-id) KEY_ID="$2"; shift 2 ;;
        --issuer) ISSUER="$2"; shift 2 ;;
        -h|--help) sed -n '2,15p' "$0"; exit 0 ;;
        *) echo "unknown argument: $1" >&2; exit 2 ;;
    esac
done

if [ -z "$KEY" ] || [ -z "$KEY_ID" ] || [ -z "$ISSUER" ]; then
    echo "usage: $0 --key <AuthKey.p8> --key-id <id> --issuer <uuid>" >&2
    exit 2
fi
if [ ! -f "$KEY" ]; then
    echo "key file not found: $KEY" >&2
    exit 2
fi

xcrun notarytool store-credentials "$PROFILE" \
    --key "$KEY" --key-id "$KEY_ID" --issuer "$ISSUER"

echo "==> profile '$PROFILE' stored. checking access to the notary service…"
xcrun notarytool history --keychain-profile "$PROFILE" >/dev/null
echo "==> ok."
