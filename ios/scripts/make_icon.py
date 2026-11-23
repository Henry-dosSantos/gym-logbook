"""Renders the 1024 px App Store icon from the Dossier mark (design/dossier-mark/dossier-mark.svg).

Same layout as design/dossier-mark/icons/icon-512.png: the mark's 100-unit box takes 62.5 % of the icon, centred,
white D on black, no transparency (App Store icons must be opaque). Drawn 4x larger and scaled down for smooth edges.

    python ios/scripts/make_icon.py
"""

from pathlib import Path

from PIL import Image, ImageDraw

SIZE = 1024
SUPER = 4
OUT = Path(__file__).resolve().parent.parent / "Dossier/Resources/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png"


def main() -> None:
    big = SIZE * SUPER
    unit = big * 0.625 / 100  # one viewBox unit
    origin = (big - 100 * unit) / 2
    img = Image.new("RGB", (big, big), (0, 0, 0))
    draw = ImageDraw.Draw(img)

    def at(v: float) -> float:
        return origin + v * unit

    # M25 12.5 H37.5 A37.5 37.5 0 0 1 37.5 87.5 H25 Z: a bar from x 25 to 37.5 and the right half of a disc
    # centred at (37.5, 50) with radius 37.5.
    draw.rectangle([at(25), at(12.5), at(37.5), at(87.5)], fill=(255, 255, 255))
    draw.pieslice([at(0), at(12.5), at(75), at(87.5)], start=-90, end=90, fill=(255, 255, 255))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.resize((SIZE, SIZE), Image.LANCZOS).save(OUT, optimize=True)
    print(OUT)


if __name__ == "__main__":
    main()
