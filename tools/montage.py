#!/usr/bin/env python3
"""
montage.py — подписанные контактные листы кандидатов для визуальной проверки.

Вход: candidates_pride.json [{id,name,urls:[...]}].
Каждый товар = строка: подпись (id | name) + миниатюры кандидатов с индексами [0],[1],...
Несколько товаров на лист. Листы → media/generated/batch/_sheets/sheet_N.png.

Человек смотрит лист, выбирает верный индекс на товар, дальше choose.py.

Пример:
  python tools/montage.py --cand candidates_pride.json
"""
import argparse, io, json, os, sys
import requests
from PIL import Image, ImageDraw, ImageFont

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0 Safari/537.36"}
TH = 240          # размер миниатюры
LBL_W = 230       # ширина колонки подписи
PAD = 8
ROWS_PER_SHEET = 5
OUTDIR = os.path.join(os.path.dirname(__file__), "..", "media", "generated", "batch", "_sheets")

try:
    FONT = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 15)
    FONT_B = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 16)
    FONT_IDX = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 20)
except Exception:
    FONT = FONT_B = FONT_IDX = ImageFont.load_default()


def thumb(url):
    try:
        d = requests.get(url, timeout=25, headers=UA).content
        im = Image.open(io.BytesIO(d)).convert("RGB")
    except Exception:
        im = Image.new("RGB", (TH, TH), (60, 60, 60))
        ImageDraw.Draw(im).text((10, TH // 2), "FAIL", fill=(255, 80, 80), font=FONT)
        return im
    im.thumbnail((TH, TH))
    canvas = Image.new("RGB", (TH, TH), (255, 255, 255))
    canvas.paste(im, ((TH - im.size[0]) // 2, (TH - im.size[1]) // 2))
    return canvas


def wrap(draw, text, font, maxw):
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if draw.textlength(t, font=font) <= maxw:
            cur = t
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def row_img(item):
    urls = item["urls"][:6]
    ncols = max(1, len(urls))
    w = LBL_W + ncols * (TH + PAD) + PAD
    h = TH + 2 * PAD
    im = Image.new("RGB", (w, h), (245, 245, 245))
    d = ImageDraw.Draw(im)
    # подпись
    d.text((PAD, PAD), f"id {item['id']}", fill=(0, 0, 0), font=FONT_B)
    for i, ln in enumerate(wrap(d, item["name"] or "(без имени)", FONT, LBL_W - PAD)):
        d.text((PAD, PAD + 24 + i * 17), ln, fill=(20, 20, 20), font=FONT)
    if not urls:
        d.text((LBL_W, h // 2), "нет кандидатов", fill=(200, 0, 0), font=FONT_B)
        return im
    x = LBL_W
    for i, u in enumerate(urls):
        t = thumb(u)
        im.paste(t, (x, PAD))
        # индекс
        d.rectangle([x, PAD, x + 26, PAD + 24], fill=(0, 0, 0))
        d.text((x + 5, PAD + 2), str(i), fill=(255, 255, 0), font=FONT_IDX)
        x += TH + PAD
    return im


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cand", required=True)
    a = ap.parse_args()
    items = json.load(open(a.cand, encoding="utf-8"))
    os.makedirs(OUTDIR, exist_ok=True)
    sheet_n = 0
    for s in range(0, len(items), ROWS_PER_SHEET):
        chunk = items[s:s + ROWS_PER_SHEET]
        rows = [row_img(it) for it in chunk]
        w = max(r.size[0] for r in rows)
        h = sum(r.size[1] for r in rows) + PAD * (len(rows) + 1)
        sheet = Image.new("RGB", (w, h), (255, 255, 255))
        y = PAD
        for r in rows:
            sheet.paste(r, (0, y))
            y += r.size[1] + PAD
        sheet_n += 1
        p = os.path.join(OUTDIR, f"sheet_{sheet_n}.png")
        sheet.save(p)
        print("saved", os.path.abspath(p), f"({len(chunk)} товаров)")
    print(f"\nЛистов: {sheet_n}. Смотри media/generated/batch/_sheets/")


if __name__ == "__main__":
    main()
