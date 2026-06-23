#!/usr/bin/env python3
"""
kie_product_photo.py — товарное фото на тёмном фоне, квадрат 1:1, через KIE Nano Banana Edit.

Вход: локальный файл с товаром (желательно уже без водяных знаков).
Делает: паддинг до квадрата → KIE google/nano-banana-edit (тёмная студия) → скачивает PNG.

Пример:
  python tools/kie_product_photo.py .firecrawl/clean/b_208.jpg --out media/generated/uno_top.png
  python tools/kie_product_photo.py in.jpg --hero      # главное фото, контрастный свет

Ключ KIE — из tools/kie_gen.py (env KIE_API_KEY или fallback).
"""
import argparse, os, sys, json, time, re, datetime, urllib.request
sys.path.insert(0, os.path.dirname(__file__))
import kie_gen as k
from PIL import Image

PROMPT_BASE = (
    "Place THIS exact product ({ptype}) on a premium dark studio background. "
    "Keep the product 100% identical — same shape, logo, text, knobs, terminals, cables, connectors, colors "
    "and details, keep exactly the same number of parts/connectors/cables as in the photo, "
    "do not redesign, do not turn it into a different device, do not add or remove anything. "
    "The background MUST be very dark — deep black to dark charcoal radial "
    "gradient, NOT white, NOT light grey, NOT a bright studio. Clean uniform dark backdrop with a subtle soft "
    "reflection under the device. Product perfectly centered, professional e-commerce catalog shot, "
    "square 1:1 composition, photorealistic, sharp focus, high detail, soft studio lighting on the product "
    "against the dark background. No watermark, no extra text, no logos other than the ones on the product itself."
)
PROMPT_HERO = PROMPT_BASE + (" Hero shot: slightly more dramatic top-down key light and a faint rim light "
    "to make the product pop against the dark background.")


def pad_square(src, dst, bg=(255, 255, 255)):
    im = Image.open(src).convert("RGB")
    w, h = im.size
    s = max(w, h)
    canvas = Image.new("RGB", (s, s), bg)
    canvas.paste(im, ((s - w) // 2, (s - h) // 2))
    canvas.save(dst, quality=92)
    return dst


def run(src, out, hero=False, ptype="a car audio product"):
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    sq = src + ".sq.jpg"
    pad_square(src, sq)
    print("Заливаю:", os.path.basename(sq))
    url = k.upload_file(sq, "avsound/prod")
    print("  ->", url)
    prompt = (PROMPT_HERO if hero else PROMPT_BASE).format(ptype=ptype)
    inp = {"prompt": prompt,
           "image_urls": [url], "output_format": "png"}
    resp = k._req("POST", k.BASE + "/createTask",
                  {"model": "google/nano-banana-edit", "input": inp})
    task_id = (resp.get("data") or {}).get("taskId")
    if not task_id:
        print("Нет taskId:", resp); sys.exit(1)
    print("taskId:", task_id)
    res_url = None
    for _ in range(60):
        d = k._req("GET", k.BASE + "/recordInfo?taskId=" + task_id).get("data", {})
        st = str(d.get("state", "")).lower()
        if st in ("success", "completed", "succeed"):
            rj = d.get("resultJson")
            if isinstance(rj, str):
                try:
                    u = json.loads(rj).get("resultUrls") or json.loads(rj).get("urls")
                    if u: res_url = u[0]
                except Exception: pass
            if not res_url:
                m = re.search(r"https?://[^\s\"']+\.(png|jpg|jpeg|webp)", json.dumps(d))
                res_url = m.group(0) if m else None
            break
        if st in ("fail", "failed", "error"):
            print("Упало:", json.dumps(d)[:600]); sys.exit(1)
        print("  ...", st or "wait"); time.sleep(5)
    if not res_url:
        print("URL не найден."); sys.exit(1)
    print("Результат:", res_url)
    rq = urllib.request.Request(res_url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0 Safari/537.36"})
    with urllib.request.urlopen(rq, timeout=120) as r, open(out, "wb") as f:
        f.write(r.read())
    try: os.remove(sq)
    except OSError: pass
    print("Сохранено:", os.path.abspath(out))
    return out


def main():
    p = argparse.ArgumentParser()
    p.add_argument("src")
    p.add_argument("--out", default="media/generated/product.png")
    p.add_argument("--hero", action="store_true")
    p.add_argument("--type", default="a car audio product", help="что за товар: 'a car audio amplifier', 'an RCA Y-splitter cable with connectors', 'a car audio ANL fuse' и т.д.")
    a = p.parse_args()
    bal = k.balance(); print(f"Баланс: {bal} cr (~${bal*k.USD_PER_CREDIT:.2f})")
    run(a.src, a.out, a.hero, a.type)
    b = k.balance(); print(f"Остаток: {b} cr (~${b*k.USD_PER_CREDIT:.2f})  (потрачено {bal-b:.0f} cr)")


if __name__ == "__main__":
    main()
