#!/bin/bash
set -e

TYPE=${1:-self-contained}
VERSION=$(grep -o '<Version>[^<]*' Aictionary/Aictionary.csproj | sed 's/<Version>//')
if [ -z "$VERSION" ]; then
    VERSION="1.0.0"
fi

build_deb() {
    local arch=$1
    local artifact_dir=$2
    local deb_arch=$3
    local package_type=$4
    
    echo "Building DEB package for $arch ($package_type)..."
    
    # Set package name and dependencies based on type
    local pkg_name="aictionary"
    local depends=""
    if [ "$package_type" = "framework-dependent" ]; then
        pkg_name="aictionary-framework-dependent"
        depends="Depends: dotnet-runtime-8.0"
    fi
    
    # Create package structure
    local pkg_dir="${pkg_name}-${VERSION}-${arch}"
    mkdir -p "$pkg_dir/DEBIAN"
    mkdir -p "$pkg_dir/usr/bin"
    mkdir -p "$pkg_dir/usr/share/applications"
    mkdir -p "$pkg_dir/usr/share/pixmaps"
    
    # Copy binary
    if [ -f "artifacts/$artifact_dir/Aictionary" ]; then
        cp "artifacts/$artifact_dir/Aictionary" "$pkg_dir/usr/bin/"
        chmod +x "$pkg_dir/usr/bin/Aictionary"
    else
        echo "Warning: Binary not found in artifacts/$artifact_dir/"
        return 1
    fi
    
    # Copy additional files for framework-dependent version
    if [ "$package_type" = "framework-dependent" ]; then
        find "artifacts/$artifact_dir" -name "*.dll" -o -name "*.so" -o -name "*.json" -o -name "*.pdb" | while read file; do
            if [ -f "$file" ]; then
                cp "$file" "$pkg_dir/usr/bin/"
            fi
        done
        # Copy Assets directory if exists
        if [ -d "artifacts/$artifact_dir/Assets" ]; then
            cp -r "artifacts/$artifact_dir/Assets" "$pkg_dir/usr/bin/"
        fi
    fi
    
    # Create control file
    {
        echo "Package: $pkg_name"
        echo "Version: $VERSION"
        echo "Section: utils"
        echo "Priority: optional"
        echo "Architecture: $deb_arch"
        echo "Maintainer: Aictionary Team"
        if [ -n "$depends" ]; then
            echo "$depends"
        fi
        echo "Description: 快速且异常好用的词典 App ($package_type)"
        echo " 基于 Avalonia 框架的跨平台词典应用程序，支持本地词库和大语言模型驱动的词义生成。"
    } > "$pkg_dir/DEBIAN/control"
    
    # Create desktop file
    cat > "$pkg_dir/usr/share/applications/${pkg_name}.desktop" << EOF
[Desktop Entry]
Name=Aictionary
Comment=快速且异常好用的词典 App
Exec=/usr/bin/Aictionary
Icon=aictionary
Terminal=false
Type=Application
Categories=Office;Dictionary;
EOF
    
    # Copy icon if exists
    if [ -f "Aictionary/Assets/AppIcon.png" ]; then
        cp "Aictionary/Assets/AppIcon.png" "$pkg_dir/usr/share/pixmaps/aictionary.png"
    fi
    
    # Build package
    fakeroot dpkg-deb --build "$pkg_dir"
    mv "${pkg_dir}.deb" "${pkg_name}_${VERSION}_${deb_arch}.deb"
    rm -rf "$pkg_dir"
    
    echo "Created: ${pkg_name}_${VERSION}_${deb_arch}.deb"
}

# Determine artifact directories based on type
if [ "$TYPE" = "framework-dependent" ]; then
    build_deb "amd64" "linux-amd64-framework-dependent" "amd64" "framework-dependent"
    build_deb "arm64" "linux-arm64-framework-dependent" "arm64" "framework-dependent"
else
    build_deb "amd64" "linux-amd64" "amd64" "self-contained"
    build_deb "arm64" "linux-arm64" "arm64" "self-contained"
fi

echo "DEB packages ($TYPE) built successfully!"