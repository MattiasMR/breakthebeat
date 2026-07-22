"""Import and optimize the approved Figma homepage assets.

Usage:
  python scripts/import_figma_home_assets.py <browser-assets-directory>
  python scripts/import_figma_home_assets.py <browser-assets-directory> --brand
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image


ASSETS = [
    ("412c4931eac3638c.png", "hero-breaker.webp", 2200, 86),
    ("b10554a80aba5687.png", "community-breaker.webp", 2200, 86),
    ("fd2afb52c2312a0b.png", "graffiti-star.webp", 760, 88),
    ("e65e52580f5a4199.png", "ucg-white.webp", 900, 90),
    ("8dab371c68c47b41.png", "gallery-01.webp", 1100, 82),
    ("1cd2a8b2b6cd3193.png", "gallery-02.webp", 1100, 82),
    ("5b8d81b5a709cb87.png", "gallery-03.webp", 1100, 82),
    ("878184366e57543d.png", "gallery-04.webp", 1100, 82),
    ("6546361a6818abdf.png", "gallery-05.webp", 1100, 82),
    ("700e26623fe10728.png", "gallery-06.webp", 1100, 82),
    ("aff61534bb94d695.png", "gallery-07.webp", 1100, 82),
    ("b69989e239b8eef1.png", "gallery-08.webp", 1100, 82),
    ("c0c507e8873d6d07.png", "gallery-09.webp", 1100, 82),
    ("5456abd43ca1362c.png", "gallery-10.webp", 1100, 82),
    ("58067d633a6d1a37.png", "gallery-11.webp", 1100, 82),
    ("a3dfe160f5545345.png", "gallery-12.webp", 1100, 82),
    ("fa6d2da6aff9ba74.png", "footer-wordmark.webp", 1800, 88),
]

BRAND_ASSETS = [
    ("52eeef32bbbbc2c1.png", "home-2026/header-logo.webp", 450, 94),
    ("c8ad38a57da8c556.png", "sponsors/axe.webp", 240, 92),
    ("98d6ca767cad890a.png", "sponsors/los-andes.webp", 480, 92),
    ("1ee8811a7231210b.png", "sponsors/rexona.webp", 240, 92),
    ("8ad0ada289069ce3.png", "sponsors/cafe-oro.webp", 320, 92),
    ("2b9fca5f1b9a92da.png", "sponsors/makai.webp", 320, 92),
]


def main() -> None:
    if len(sys.argv) not in (2, 3) or (len(sys.argv) == 3 and sys.argv[2] != "--brand"):
        raise SystemExit("Provide the browser asset bundle directory and optionally --brand.")

    source_dir = Path(sys.argv[1])
    assets_root = Path(__file__).resolve().parents[1] / "public" / "assets"
    brand_only = len(sys.argv) == 3
    mappings = BRAND_ASSETS if brand_only else [
        (source_name, f"home-2026/{output_name}", max_width, quality)
        for source_name, output_name, max_width, quality in ASSETS
    ]

    for source_name, output_name, max_width, quality in mappings:
        output_path = assets_root / output_name
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with Image.open(source_dir / source_name) as image:
            if image.width > max_width:
                height = round(image.height * (max_width / image.width))
                image = image.resize((max_width, height), Image.Resampling.LANCZOS)
            image.save(output_path, "WEBP", quality=quality, method=6)

    if not brand_only:
        dancer_svg = (source_dir / "6c03464b44dfe976.svg").read_text(encoding="utf-8")
        if "xmlns=" not in dancer_svg.partition(">")[0]:
            dancer_svg = dancer_svg.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ', 1)
        (assets_root / "home-2026" / "dancer.svg").write_text(dancer_svg, encoding="utf-8")


if __name__ == "__main__":
    main()
