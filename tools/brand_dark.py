#!/usr/bin/env python3
"""
brand_dark.py — массовая обработка бренда БЕЗ генерации: реальное фото товара
→ вырез фона → тёмный студийный фон (dark_bg) → заливка. Бесплатно, быстро,
товар настоящий (никаких выдуманных устройств).

python tools/brand_dark.py "Helix" --workers 2
python tools/brand_dark.py "Hellion" --only 42275,42307
"""
import sys, os, re, time, argparse, subprocess, tempfile
sys.path.insert(0, os.path.dirname(__file__)); sys.path.insert(0, ".firecrawl")
import requests
from PIL import Image
from io import BytesIO
import woo, dark_bg
import flex  # фолбэк-источник (firecrawl)

LOG = "media/generated/brand_dark_log.md"
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0"}


def _get(u, t=5):
    for _ in range(t):
        try:
            r = requests.get(u, timeout=30, headers=UA)
            if r.status_code == 200:
                return r
        except Exception:
            pass
        time.sleep(2)


def shopbear_imgs(query, n=3):
    """Прямой поиск shop-bear → страница товара → галерея (без firecrawl)."""
    r = _get("https://shop-bear.ru/search/index.php?q=" + requests.utils.quote(query))
    if not r:
        return []
    links = list(dict.fromkeys(re.findall(r'/catalog/[a-z0-9_-]+/[a-z0-9_-]+/[a-z0-9_-]+/', r.text)))
    for path in links[:2]:
        pr = _get("https://shop-bear.ru" + path)
        if not pr:
            continue
        full = [u for u in dict.fromkeys(re.findall(r'/upload/iblock/[\w./-]+?\.(?:jpg|jpeg|png)', pr.text))
                if 'resize_cache' not in u]
        out = []
        for u in full:
            d = _get("https://shop-bear.ru" + u, 3)
            if not d:
                continue
            try:
                if Image.open(BytesIO(d.content)).size[0] >= 500:
                    p = f".firecrawl/sb_{abs(hash(u))%10**8}.jpg"
                    open(p, "wb").write(d.content); out.append(p)
            except Exception:
                pass
            if len(out) >= n:
                break
        if out:
            return out
    return []


def log(s):
    print(s, flush=True)
    open(LOG, "a", encoding="utf-8").write(time.strftime("%H:%M:%S ") + s + "\n")


def guess_type(n):  # только для запроса фото, не для генерации
    return n


def process(pid, name):
    q = re.sub(r'^(Усилитель|Сабвуфер|Процессорный усилитель|Моноблок|Преобразователь|Пульт управления|Компонентная акустика|Коаксиальная акустика|Среднечастотная акустика|Твитеры?|Твитера|Магнитола|Камера)\s+', '', name).strip()
    got = shopbear_imgs(q, 3)
    if not got:  # фолбэк firecrawl
        urls = flex.search_urls(q + " купить")
        for u in urls[:6]:
            got = flex.imgs_from(u, 3)
            if got:
                break
    if not got:
        log(f"FAIL {pid} {name}: нет фото"); return "no-src"
    outs = []
    for i, s in enumerate(got):
        o = f"media/generated/bd_{pid}_{i}.png"
        try:
            dark_bg.run(s, o); outs.append(o)
        except Exception as e:
            log(f"  {pid} dark_bg err {i}: {type(e).__name__}")
    if not outs:
        log(f"FAIL {pid}: обработка"); return "fail"
    try:
        up = [{"src": woo.upload_tmp(o)} for o in outs]
        r = woo._req("PUT", f"/products/{pid}", json={"images": up})
        if r.status_code == 200:
            log(f"OK {pid} {name}: {len(up)} фото"); return "ok"
        log(f"UPERR {pid}: {r.status_code}"); return "uperr"
    except Exception as e:
        log(f"EXC {pid}: {type(e).__name__}"); return "exc"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("brand")
    ap.add_argument("--only")
    ap.add_argument("--limit", type=int, default=100)
    a = ap.parse_args()
    r = woo._req("GET", "/products", params={"search": a.brand, "per_page": a.limit}).json()
    only = set(int(x) for x in a.only.split(",")) if a.only else None
    items = [(p["id"], p["name"]) for p in r if (only is None or p["id"] in only)]
    log(f"=== {a.brand}: {len(items)} товаров (dark_bg, без генерации) ===")
    res = {}
    for pid, name in items:
        st = process(pid, name); res[st] = res.get(st, 0) + 1
    log(f"=== ИТОГ {a.brand}: {res} ===")


if __name__ == "__main__":
    main()
