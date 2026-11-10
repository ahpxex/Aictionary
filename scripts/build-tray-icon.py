"""Build the macOS menu bar (tray) template icon from the app logo.

Run: uv run --with pillow python scripts/build-tray-icon.py

The logo's "a" is cut out of a solid shape, so its alpha channel alone is a
template image: macOS paints the opaque pixels in the menu bar's own color
and leaves the cut-out transparent, in light and dark mode alike. Using the
logo keeps the menu bar icon recognizable as the app in the Dock.

tray-icon draws menu bar images 18 pt tall, which is 36 device pixels on a
Retina display; the icon is rendered at exactly that size so it is never
scaled up. The glyph is inset by two pixels on each side, the usual margin
around a menu bar symbol.
"""
from pathlib import Path

from PIL import Image

SIZE = 36
INSET = 2

root = Path(__file__).resolve().parents[1]
source = root / "src-tauri/icons/icon.png"
output = root / "src-tauri/icons/tray-template.png"

alpha = Image.open(source).convert("RGBA").getchannel("A")
bbox = alpha.getbbox()
assert bbox, "the logo has no opaque pixels"
glyph = alpha.crop(bbox)

inner = SIZE - 2 * INSET
scale = inner / max(glyph.width, glyph.height)
glyph = glyph.resize(
    (round(glyph.width * scale), round(glyph.height * scale)), Image.LANCZOS
)

mask = Image.new("L", (SIZE, SIZE), 0)
mask.paste(glyph, ((SIZE - glyph.width) // 2, (SIZE - glyph.height) // 2))

# Template images only use alpha; the color is irrelevant, black by convention.
icon = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
icon.putalpha(mask)
icon.save(output, optimize=True)
print(f"wrote {output.relative_to(root)} ({SIZE}x{SIZE})")
