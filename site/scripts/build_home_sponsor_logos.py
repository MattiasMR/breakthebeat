"""Build transparent, color-preserving sponsor marks for the pink homepage strip."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageChops, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "public" / "assets" / "sponsors"
OUTPUT_DIR = SOURCE_DIR / "home"


def transparent_mark(source: Path) -> Image.Image:
    image = Image.open(source).convert("RGBA")
    red, green, blue, source_alpha = image.split()

    if source_alpha.getextrema()[0] < 255:
        alpha = source_alpha
    else:
        near_white = ImageChops.multiply(
            ImageChops.multiply(
                red.point(lambda value: 255 if value >= 245 else 0),
                green.point(lambda value: 255 if value >= 245 else 0),
            ),
            blue.point(lambda value: 255 if value >= 245 else 0),
        )
        for corner in ((0, 0), (near_white.width - 1, 0), (0, near_white.height - 1), (near_white.width - 1, near_white.height - 1)):
            if near_white.getpixel(corner) == 255:
                ImageDraw.floodfill(near_white, corner, 128)
        alpha = near_white.point(lambda value: 0 if value == 128 else 255)

    result = image.copy()
    result.putalpha(alpha)
    bounds = result.getbbox()
    if not bounds:
        raise ValueError(f"No visible logo pixels found in {source.name}")

    result = result.crop(bounds)
    result.thumbnail((480, 120), Image.Resampling.LANCZOS)
    padded = Image.new("RGBA", (result.width + 24, result.height + 16), (255, 255, 255, 0))
    padded.alpha_composite(result, (12, 8))
    return padded


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for source in sorted(SOURCE_DIR.glob("*.png")):
        target = OUTPUT_DIR / f"{source.stem}.webp"
        transparent_mark(source).save(target, "WEBP", lossless=True, method=6)
        print(f"{source.name} -> {target.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
