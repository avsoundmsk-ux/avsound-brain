"""
image_optimizer — приведение generated-фото к единому виду каталога.

- квадрат 1:1, по умолчанию 1600x1600;
- товар НЕ растягивать (сохранять пропорции), вписывать с тёмным паддингом;
- удалять EXIF;
- конвертировать в WebP, оптимизировать вес;
- сохранять в images/generated/optimized/.

Только локально. Ничего не грузит в WooCommerce, сайт не меняет.
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from core.logger import get_logger  # noqa: E402

log = get_logger("image_optimizer")

PROJECT_ROOT = Path(__file__).resolve().parents[2]
OPTIMIZED_DIR = PROJECT_ROOT / "images" / "generated" / "optimized"

TARGET = 1600
DARK_BG = (18, 18, 20)   # тёмный фон каталога
WEBP_QUALITY = 85


def optimize(src: str | Path, size: int = TARGET, quality: int = WEBP_QUALITY) -> Path:
    """Привести изображение к квадрату size×size (WebP, без EXIF). Вернуть путь."""
    src = Path(src)
    im = Image.open(src).convert("RGB")  # convert убирает альфу/EXIF-ориентацию

    # вписать в квадрат с сохранением пропорций (без растягивания)
    im.thumbnail((size, size), Image.LANCZOS)
    # цвет паддинга = медиана 4 углов исходника (бесшовно, без "квадрата в квадрате")
    w, h = im.size
    corners = [im.getpixel((0, 0)), im.getpixel((w - 1, 0)),
               im.getpixel((0, h - 1)), im.getpixel((w - 1, h - 1))]
    pad = tuple(sorted(c[i] for c in corners)[1] for i in range(3))  # 2-й по величине = устойчивая медиана
    canvas = Image.new("RGB", (size, size), pad)
    off = ((size - im.width) // 2, (size - im.height) // 2)
    canvas.paste(im, off)

    OPTIMIZED_DIR.mkdir(parents=True, exist_ok=True)
    dst = OPTIMIZED_DIR / f"{src.stem}.webp"
    # save без EXIF (новый объект canvas его не содержит)
    canvas.save(dst, "WEBP", quality=quality, method=6)
    return dst


def _make_dummy(path: Path) -> Path:
    """Тестовая картинка не-квадрат (1200x800) с объектом, если нет реального файла."""
    path.parent.mkdir(parents=True, exist_ok=True)
    im = Image.new("RGB", (1200, 800), (200, 200, 205))
    # «товар» по центру
    for x in range(450, 750):
        for y in range(300, 500):
            im.putpixel((x, y), (40, 40, 45))
    im.save(path, "JPEG", quality=92)
    return path


if __name__ == "__main__":
    # взять реальный generated, иначе dummy
    gen_dir = PROJECT_ROOT / "images" / "generated"
    real = next((p for p in gen_dir.glob("*.png")), None) if gen_dir.exists() else None
    src = real or _make_dummy(PROJECT_ROOT / "images" / "temp" / "dummy.jpg")

    before = src.stat().st_size
    out = optimize(src)
    after = out.stat().st_size
    w, h = Image.open(out).size

    log.info("Источник : %s", src)
    log.info("Optimized: %s", out)
    log.info("Размер до : %d КБ", before // 1024 or 1)
    log.info("Размер после: %d КБ", after // 1024 or 1)
    log.info("Resolution: %dx%d (WebP, без EXIF)", w, h)
