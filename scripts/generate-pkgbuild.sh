#!/bin/bash
set -e

# Extract version from project file
VERSION=$(grep -o '<Version>[^<]*' Aictionary/Aictionary.csproj | sed 's/<Version>//' || echo "1.0.0")

# Get git commit hash for pkgver
COMMIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

# Calculate checksums for artifacts
AMD64_SHA256=""
ARM64_SHA256=""

if [ -f "artifacts/linux-amd64/Aictionary" ]; then
    AMD64_SHA256=$(sha256sum artifacts/linux-amd64/Aictionary | cut -d' ' -f1)
fi

if [ -f "artifacts/linux-arm64/Aictionary" ]; then
    ARM64_SHA256=$(sha256sum artifacts/linux-arm64/Aictionary | cut -d' ' -f1)
fi

# Generate PKGBUILD
cat > PKGBUILD << EOF
# Maintainer: Aictionary Team
pkgname=aictionary
pkgver=${VERSION}
pkgrel=1
pkgdesc="快速且异常好用的词典 App"
arch=('x86_64' 'aarch64')
url="https://github.com/username/Aictionary"
license=('MIT')
depends=('dotnet-runtime>=8.0')
provides=('aictionary')
conflicts=('aictionary-bin')

source_x86_64=("aictionary-\${pkgver}-x86_64::https://github.com/username/Aictionary/releases/download/v\${pkgver}/Aictionary")
source_aarch64=("aictionary-\${pkgver}-aarch64::https://github.com/username/Aictionary/releases/download/v\${pkgver}/Aictionary")

sha256sums_x86_64=('${AMD64_SHA256}')
sha256sums_aarch64=('${ARM64_SHA256}')

package() {
    # Install binary
    install -Dm755 "\${srcdir}/aictionary-\${pkgver}-\${CARCH}" "\${pkgdir}/usr/bin/aictionary"
    
    # Install desktop file
    install -Dm644 /dev/stdin "\${pkgdir}/usr/share/applications/aictionary.desktop" << 'DESKTOP'
[Desktop Entry]
Name=Aictionary
Comment=快速且异常好用的词典 App
Exec=/usr/bin/aictionary
Icon=aictionary
Terminal=false
Type=Application
Categories=Office;Dictionary;
DESKTOP
    
    # Install icon if available
    if [ -f "\${srcdir}/AppIcon.png" ]; then
        install -Dm644 "\${srcdir}/AppIcon.png" "\${pkgdir}/usr/share/pixmaps/aictionary.png"
    fi
}
EOF

echo "PKGBUILD generated successfully!"
echo "Version: $VERSION"
echo "Commit: $COMMIT_HASH"
echo "AMD64 SHA256: $AMD64_SHA256"
echo "ARM64 SHA256: $ARM64_SHA256"