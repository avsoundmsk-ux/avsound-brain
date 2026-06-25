#!/usr/bin/env python3
"""
dark_bg.py — настоящий товар на красивом тёмном фоне. БЕЗ KIE/генерации.

Берёт реальное фото товара → вырезает фон (rembg) → кладёт на тёмный
радиальный градиент, квадрат 1:1, мягкая тень-отражение снизу. Товар не
меняется (никаких выдуманных устройств), просто красивый фон. Бесплатно.

Использование как модуль: from dark_bg import run; run(src, out)
CLI: python tools/dark_bg.py src.jpg out.png
"""
import sys, os
from collections import deque
from PIL import Image, ImageFilter, ImageDraw, ImageChops


def _cut_white(im, tol=32):
    """Убрать白/однотонный фон flood-fill'ом от всех 4 краёв (без ML).
    Подходит для студийных фото товара на белом/светлом фоне."""
    im = im.convert("RGB")
    W, H = im.size
    px = im.load()
    alpha = Image.new("L", (W, H), 255)
    ap = alpha.load()
    # цвет фона = среднее по углам
    corners = [px[0, 0], px[W - 1, 0], px[0, H - 1], px[W - 1, 1]]
    bg = tuple(sum(c[i] for c in corners) // 4 for i in range(3))
    if sum(bg) < 3 * 90:  # фон тёмный — не трогаем (вырез не нужен)
        return im.convert("RGBA"), False
    seen = bytearray(W * H)
    dq = deque()
    for x in range(W):
        dq.append((x, 0)); dq.append((x, H - 1))
    for y in range(H):
        dq.append((0, y)); dq.append((W - 1, y))
    while dq:
        x, y = dq.popleft()
        if x < 0 or y < 0 or x >= W or y >= H or seen[y * W + x]:
            continue
        seen[y * W + x] = 1
        r, g, b = px[x, y]
        if abs(r - bg[0]) <= tol and abs(g - bg[1]) <= tol and abs(b - bg[2]) <= tol:
            ap[x, y] = 0
            dq.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])
    out = im.convert("RGBA")
    # сгладить край альфы
    alpha = alpha.filter(ImageFilter.GaussianBlur(0.8))
    out.putalpha(alpha)
    return out, True


def _radial_dark(size):
    """Тёмный радиальный градиент: центр ~#2a2a2e, края ~#0a0a0c."""
    W = H = size
    bg = Image.new("RGB", (W, H), (10, 10, 12))
    cx, cy = W / 2, H * 0.44
    maxd = (W ** 2 + H ** 2) ** 0.5 / 2
    px = bg.load()
    c0 = (44, 44, 50); c1 = (8, 8, 10)
    for y in range(H):
        for x in range(0, W, 2):
            d = (((x - cx) ** 2 + (y - cy) ** 2) ** 0.5) / maxd
            d = min(1.0, d)
            r = int(c0[0] + (c1[0] - c0[0]) * d)
            g = int(c0[1] + (c1[1] - c0[1]) * d)
            b = int(c0[2] + (c1[2] - c0[2]) * d)
            px[x, y] = (r, g, b)
            if x + 1 < W:
                px[x + 1, y] = (r, g, b)
    return bg


def run(src, out, size=1200, margin=0.16):
    im = Image.open(src).convert("RGBA")
    cut, _ = _cut_white(im)
    bbox = cut.getbbox()
    if bbox:
        cut = cut.crop(bbox)
    # вписать в квадрат с полями
    avail = int(size * (1 - 2 * margin))
    w, h = cut.size
    sc = min(avail / w, avail / h)
    nw, nh = max(1, int(w * sc)), max(1, int(h * sc))
    cut = cut.resize((nw, nh), Image.LANCZOS)

    bg = _radial_dark(size)
    cx = (size - nw) // 2
    cy = int(size * 0.40) - nh // 2
    cy = max(int(size * margin), cy)

    # отражение снизу
    refl = cut.transpose(Image.FLIP_TOP_BOTTOM)
    fade = Image.new("L", refl.size, 0)
    fd = fade.load()
    for yy in range(refl.size[1]):
        a = int(70 * (1 - yy / refl.size[1]))
        for xx in range(refl.size[0]):
            fd[xx, yy] = a
    ra = refl.split()[3].point(lambda p: p)
    from PIL import ImageChops
    ra = ImageChops.multiply(ra, fade)
    refl.putalpha(ra)
    bg.paste(refl, (cx, cy + nh + 4), refl)

    bg.paste(cut, (cx, cy), cut)
    bg.save(out, quality=92)
    return out


if __name__ == "__main__":
    run(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "out.png")
    print("ok", sys.argv[1])
