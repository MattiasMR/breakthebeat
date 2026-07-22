"""Import and optimize the approved Figma homepage assets.

Usage: python scripts/import_figma_home_assets.py <browser-assets-directory>
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


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Provide the browser asset bundle directory.")

    source_dir = Path(sys.argv[1])
    output_dir = Path(__file__).resolve().parents[1] / "public" / "assets" / "home-2026"
    output_dir.mkdir(parents=True, exist_ok=True)

    for source_name, output_name, max_width, quality in ASSETS:
        with Image.open(source_dir / source_name) as image:
            if image.width > max_width:
                height = round(image.height * (max_width / image.width))
                image = image.resize((max_width, height), Image.Resampling.LANCZOS)
            image.save(output_dir / output_name, "WEBP", quality=quality, method=6)

    dancer_svg = (source_dir / "6c03464b44dfe976.svg").read_text(encoding="utf-8")
    if "xmlns=" not in dancer_svg.partition(">")[0]:
        dancer_svg = dancer_svg.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ', 1)
    (output_dir / "dancer.svg").write_text(dancer_svg, encoding="utf-8")


if __name__ == "__main__":
    main()
