# iOS / TestFlight releases

The iOS app uses bundle ID `com.ahpx.aictionary-re`, Apple team `L7GVXT64TV`,
and App Store Connect app ID `6814765379`. The first iOS version is 3.4.0 (build 1.1).
The deployment target is iOS 16.4, matching the WebKit baseline required by
Tailwind CSS v4. The build number is independent of desktop release tags. Tauri appends the
script's integer to the configured base `1`: argument `1` produces `1.1`,
argument `2` produces `1.2`. Increase that integer on each subsequent upload. iOS updates are distributed by Apple.

## Signing and credentials

The signing identity is **Apple Distribution: Yanxiao Fan (L7GVXT64TV)**.
Use the **Aictionary iOS App Store** provisioning profile. The Developer ID
certificate used for notarized macOS downloads cannot sign an App Store iOS app.

The 1Password **Private** vault contains:

- **Aictionary iOS Distribution (Apple Distribution certificate)**: PKCS12
  archive and password, private key, public certificate, and App Store profile.
- **RA App store stuff**: the existing team App Store Connect API key, its key ID
  and issuer ID. The release script reads these through `op` only for upload.

The distribution identity and profile are installed on the release Mac. On a
new Mac, restore the PKCS12 and its password from 1Password into the login
keychain, and install the profile in
`~/Library/Developer/Xcode/UserData/Provisioning Profiles/`. Decode the stored
base64 fields into a private temporary directory, never the repository. Keep
the certificate's private key: regenerating a certificate is not a substitute
for restoring it.

## Build and upload

Requires Xcode 26 or later, the iOS SDK, XcodeGen, Bun, Rust with the
`aarch64-apple-ios` target, and authenticated 1Password CLI for upload.

```bash
bun install
# Build and export, using the next unused build number:
scripts/release-ios.sh 2
# Build, export, and upload to App Store Connect:
scripts/release-ios.sh 2 --upload
```

The script clears proxy variables for Bun, then uses the local network proxy
for Apple upload/export tools. The IPA is written to
`src-tauri/gen/apple/build/app-store/Aictionary.ipa`. The generated Xcode project
is committed; `project.yml` is the source for native project edits. Keep
`libsqlite3.tbd` linked: iOS uses the SDK's SQLite, while other platforms keep
the bundled version. The privacy manifest declares local file metadata access;
the signed binary does not contain the bundled SQLite filesystem-space probes.

`Info.ios.plist` supplies the local-network purpose string and the exempt
encryption declaration. The app uses standard HTTPS/TLS. Reassess the
declaration and privacy policy if encryption or data collection changes.

The archive directory is shared by Tauri's simulator and device build commands.
Export the device IPA before building a simulator variant. Simulator builds may
require moving an existing `build/arm64-sim/Aictionary.app` aside before rebuilding
(Tauri otherwise fails to rename into the nonempty directory).

## External testing

App Store Connect's **Public Beta** group has a public link:
<https://testflight.apple.com/join/qEzjS8bY>. A link alone does not make a build
available. After upload processing, attach the build to this group, provide
localized “What to Test” notes, and submit it for external Beta App Review.
The first external build requires Apple's approval. Verify the build's external
testing status before announcing that installation is available.

The test information has English and Simplified Chinese descriptions, a public
[privacy policy](../PRIVACY.md), feedback email, and review contact information.
No test login is required. Core acceptance is dictionary download and checksum
verification, offline lookup, suggestions, history, phone/tablet layout, and
pronunciation. AI and Anki use the tester's own optional service configuration.

For simulator checks, use `bun tauri ios build --target aarch64-sim --debug --no-sign --ci`,
then install the resulting app with `xcrun simctl install`. Simulator checks do
not establish physical-device behavior or TestFlight review approval.
