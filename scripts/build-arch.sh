#!/bin/bash
set -e

TYPE=${1:-self-contained}
echo "Building Arch Linux package ($TYPE)..."

# Set package name and dependencies based on type
PKG_NAME="aictionary"
DEPENDS="depends=()"
if [ "$TYPE" = "framework-dependent" ]; then
    PKG_NAME="aictionary-framework-dependent"
    DEPENDS="depends=('dotnet-runtime')"
fi

# Create PKGBUILD based on type
cat > PKGBUILD << EOF
# Maintainer: Aictionary Team
pkgname=$PKG_NAME
pkgver=1.0.0
pkgrel=1
pkgdesc="快速且异常好用的词典 App ($TYPE)"
arch=('x86_64' 'aarch64')
url="https://github.com/username/Aictionary"
license=('MIT')
$DEPENDS
provides=('aictionary')

package() {
    # Create directories
    install -dm755 "\${pkgdir}/usr/bin"
    install -dm755 "\${pkgdir}/usr/share/applications"
    install -dm755 "\${pkgdir}/usr/share/pixmaps"
    
    # Determine source directory based on type and architecture
    local src_dir=""
    if [ "$TYPE" = "framework-dependent" ]; then
        if [ "\$CARCH" = "x86_64" ]; then
            src_dir="\${srcdir}/../artifacts/linux-amd64-framework-dependent"
        elif [ "\$CARCH" = "aarch64" ]; then
            src_dir="\${srcdir}/../artifacts/linux-arm64-framework-dependent"
        fi
    else
        if [ "\$CARCH" = "x86_64" ]; then
            src_dir="\${srcdir}/../artifacts/linux-amd64"
        elif [ "\$CARCH" = "aarch64" ]; then
            src_dir="\${srcdir}/../artifacts/linux-arm64"
        fi
    fi
    
    # Install binary
    if [ -f "\$src_dir/Aictionary" ]; then
        install -Dm755 "\$src_dir/Aictionary" "\${pkgdir}/usr/bin/aictionary"
    fi
    
    # Install additional files for framework-dependent version
    if [ "$TYPE" = "framework-dependent" ]; then
        find "\$src_dir" -name "*.dll" -o -name "*.so" -o -name "*.json" -o -name "*.pdb" | while read file; do
            if [ -f "\$file" ]; then
                install -Dm644 "\$file" "\${pkgdir}/usr/bin/\$(basename "\$file")"
            fi
        done
        # Copy Assets directory if exists
        if [ -d "\$src_dir/Assets" ]; then
            cp -r "\$src_dir/Assets" "\${pkgdir}/usr/bin/"
        fi
    fi
    
    # Install desktop file
    cat > "\${pkgdir}/usr/share/applications/$PKG_NAME.desktop" << 'DESKTOP'
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
    if [ -f "\${srcdir}/../Aictionary/Assets/AppIcon.png" ]; then
        install -Dm644 "\${srcdir}/../Aictionary/Assets/AppIcon.png" "\${pkgdir}/usr/share/pixmaps/aictionary.png"
    fi
}
EOF

# Build package (skip dependency checks since we're in a container)
makepkg -f --noconfirm --nodeps

echo "Arch Linux package ($TYPE) built successfully!"
ls -la *.pkg.tar.zst