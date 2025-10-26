# Maintainer: Aictionary Team
pkgname=aictionary
pkgver=
pkgrel=1
pkgdesc="快速且异常好用的词典 App"
arch=('x86_64' 'aarch64')
url="https://github.com/username/Aictionary"
license=('MIT')
depends=('dotnet-runtime>=8.0')
provides=('aictionary')
conflicts=('aictionary-bin')

source_x86_64=("aictionary-${pkgver}-x86_64::https://github.com/username/Aictionary/releases/download/v${pkgver}/Aictionary")
source_aarch64=("aictionary-${pkgver}-aarch64::https://github.com/username/Aictionary/releases/download/v${pkgver}/Aictionary")

sha256sums_x86_64=('')
sha256sums_aarch64=('')

package() {
    # Install binary
    install -Dm755 "${srcdir}/aictionary-${pkgver}-${CARCH}" "${pkgdir}/usr/bin/aictionary"
    
    # Install desktop file
    install -Dm644 /dev/stdin "${pkgdir}/usr/share/applications/aictionary.desktop" << 'DESKTOP'
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
    if [ -f "${srcdir}/AppIcon.png" ]; then
        install -Dm644 "${srcdir}/AppIcon.png" "${pkgdir}/usr/share/pixmaps/aictionary.png"
    fi
}
