#!/usr/bin/env python3
"""
woo_batch.py — массовый конвейер фото каталога av-sound.ru, параллельно.

Качество = как в одиночном пайплайне (тот же KIE Nano Banana, тот же промпт,
та же чистка водяных знаков). Быстрее за счёт:
  - параллельных воркеров (несколько товаров одновременно, KIE держит параллель)
  - авто-детекта светлого фона → авто-перегенерация (без человека в цикле)
  - пропуска уже готовых, ретраев, manifest-лога

Два этапа:
  1) source — авто-сбор фото-кандидатов по товарам → manifest.json (быстро глянуть/править)
  2) run    — скачать → почистить знак → KIE тёмная студия → залить, в N потоков

Примеры:
  python tools/woo_batch.py source --brand Pride --out manifest_pride.json
  python tools/woo_batch.py run --manifest manifest_pride.json --workers 4
  python tools/woo_batch.py run --manifest manifest_pride.json --only 41562,41546

Формат manifest.json:
[
  {"id": 41562, "name": "Pride DUE", "type": "a car audio amplifier",
   "sources": ["https://.../a.jpg", "local/path.jpg"], "clean_wm": true}
]
"""
import argparse, json, os, sys, time, re, threading, urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import kie_gen as k
import kie_product_photo as kp
import woo

OUT = os.path.join(os.path.dirname(__file__), "..", "media", "generated", "batch")
LOG = os.path.join(OUT, "_batch_log.md")
_loglock = threading.Lock()
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0 Safari/537.36"}

# дефолтный bbox водяного знака shop-bear для фото 1920x1080 (низ-право)
WM_BBOX = (1330, 905, 1920, 1080)
LIGHT_BG_MAX = 110   # средняя яркость верхней полосы; выше = фон светлый → перегенерить


def logline(s):
    os.makedirs(OUT, exist_ok=True)
    with _loglock:
        with open(LOG, "a", encoding="utf-8") as f:
            f.write(f"{time.strftime('%H:%M:%S')}  {s}\n")
    print(s)


# ---------------- ЭТАП SOURCE: авто-сбор фото ----------------
def firecrawl_imgs(url):
    """Скачать страницу через firecrawl CLI, вытащить крупные картинки товара."""
    import subprocess, tempfile
    tmp = tempfile.mktemp(suffix=".html")
    try:
        subprocess.run(f'firecrawl scrape "{url}" --format rawHtml -o "{tmp}"',
                       shell=True, capture_output=True, timeout=90)
    except subprocess.TimeoutExpired:
        return []
    if not os.path.exists(tmp):
        return []
    html = open(tmp, encoding="utf-8", errors="ignore").read()
    os.remove(tmp)
    urls = sorted(set(re.findall(r'https://[^\s"\']+/upload/iblock/[^\s"\']+\.(?:jpg|jpeg|png)', html)))
    urls += sorted(set(re.findall(r'https://[^\s"\']+/wp-content/uploads/[^\s"\']+\.(?:jpg|jpeg|png|webp)', html)))
    return [u for u in urls if "resize_cache" not in u and "logo" not in u.lower()]


def big_enough(url, minpx=600):
    try:
        d = requests.get(url, timeout=20, headers=UA).content
        from io import BytesIO
        return Image.open(BytesIO(d)).size[0] >= minpx
    except Exception:
        return False


def cmd_source(a):
    """Найти товары бренда без фото → собрать кандидатов с shop-bear/pride.audio."""
    r = woo._req("GET", "/products", params={"search": a.brand, "per_page": 100})
    prods = [p for p in r.json() if len(p.get("images", [])) <= a.max_existing]
    out = []
    for p in prods:
        name = p["name"]
        q = f"{name} site:shop-bear.ru"
        # быстрый поиск страницы товара
        import subprocess, tempfile
        tmp = tempfile.mktemp(suffix=".md")
        subprocess.run(f'firecrawl search "{name} shop-bear" -o "{tmp}"',
                       shell=True, capture_output=True, timeout=90)
        page = None
        if os.path.exists(tmp):
            txt = open(tmp, encoding="utf-8", errors="ignore").read()
            os.remove(tmp)
            m = re.search(r'https://shop-bear\.ru/catalog/\S+/', txt)
            if m:
                page = m.group(0).rstrip(").,")
        srcs = []
        if page:
            imgs = firecrawl_imgs(page)
            srcs = [u for u in imgs if big_enough(u)][:4]
        out.append({"id": p["id"], "name": name,
                    "type": guess_type(name), "sources": srcs,
                    "clean_wm": bool(page and "shop-bear" in (page or ""))})
        logline(f"source {p['id']} {name}: {len(srcs)} фото")
    json.dump(out, open(a.out, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"\nГотово: {a.out} ({len(out)} товаров). Проверь sources перед run.")


def guess_type(name):
    n = name.lower()
    if any(w in n for w in ["саб", "sub", "м.", "m.", " m9", "m9", "m12", "м9"]): return "a car audio subwoofer speaker driver"
    if any(w in n for w in ["усилит", "моноблок", "quattro", "uno", "due", "mille", "mezzo", "amp"]): return "a car audio amplifier"
    if any(w in n for w in ["акустик", "динам", "коаксиал", "компонент", "harmony", "ruby", "твит", "пищал"]): return "a car audio speaker"
    if any(w in n for w in ["магнитол", "teyes", "nakamichi m"]): return "a car stereo head unit"
    if any(w in n for w in ["rca", "y-", "кабель", "провод", "дистриб", "onyx", "клемм", "fuse", "предохран"]): return "a car audio wiring accessory"
    return "a car audio product"


# ---------------- ЭТАП RUN: обработка ----------------
def fetch(src, dst):
    if src.startswith("http"):
        req = urllib.request.Request(src, headers=UA)
        with urllib.request.urlopen(req, timeout=60) as r, open(dst, "wb") as f:
            f.write(r.read())
    else:
        Image.open(src).save(dst)
    return dst


def clean_wm(path, bbox=WM_BBOX):
    """Закрасить угол с чужим водяным знаком цветом соседнего фона (только если фото большое)."""
    im = Image.open(path).convert("RGB")
    W, H = im.size
    if (W, H) != (1920, 1080):
        return path  # bbox рассчитан на 1920x1080; иначе пропускаем (обычно знак только у shop-bear hi-res)
    px = im.load(); x0, y0, x1, y1 = bbox; sy = y0 - 4
    for x in range(x0, min(x1, W)):
        c = px[x, sy]
        for y in range(y0, min(y1, H)):
            px[x, y] = c
    im.save(path, quality=92)
    return path


def too_light(png):
    """True если верхняя полоса фона слишком светлая (KIE проигнорил тёмный фон)."""
    im = Image.open(png).convert("L")
    w, h = im.size
    strip = im.crop((0, 0, w, int(h * 0.06)))
    px = list(strip.getdata())
    return (sum(px) / len(px)) > LIGHT_BG_MAX


def kie_studio(src_clean, out, ptype, tries=3):
    """KIE тёмная студия с авто-перегенерацией при светлом фоне."""
    for t in range(tries):
        kp.run(src_clean, out, hero=True, ptype=ptype)
        if not too_light(out):
            return True
        logline(f"  светлый фон, перегенерация {t+1}/{tries}: {os.path.basename(out)}")
    return True  # отдать что есть после tries


def process(entry, force=False):
    pid = entry["id"]; name = entry.get("name", str(pid))
    srcs = entry.get("sources", [])
    if not srcs:
        logline(f"SKIP {pid} {name}: нет источников"); return (pid, "no-src")
    if not force:
        cur = woo._req("GET", f"/products/{pid}").json().get("images", [])
        if any("kie" in (i.get("src", "")) or "_batch" in i.get("src", "") for i in cur):
            logline(f"SKIP {pid} {name}: уже обработан"); return (pid, "done")
    ptype = entry.get("type", "a car audio product")
    wd = os.path.join(OUT, str(pid)); os.makedirs(wd, exist_ok=True)
    finals = []
    for i, s in enumerate(srcs):
        raw = os.path.join(wd, f"src{i}.jpg")
        try:
            fetch(s, raw)
        except Exception as e:
            logline(f"  {pid} fetch fail {i}: {type(e).__name__}"); continue
        if entry.get("clean_wm"):
            clean_wm(raw)
        out = os.path.join(wd, f"kie{i}.png")
        try:
            kie_studio(raw, out, ptype)
            finals.append(out)
        except Exception as e:
            logline(f"  {pid} KIE fail {i}: {type(e).__name__}")
    if not finals:
        logline(f"FAIL {pid} {name}: нет результатов"); return (pid, "fail")
    # заливка
    try:
        imgs = [{"src": woo.upload_tmp(f)} for f in finals]
        r = woo._req("PUT", f"/products/{pid}", json={"images": imgs})
        if r.status_code == 200:
            logline(f"OK {pid} {name}: {len(imgs)} фото"); return (pid, "ok")
        logline(f"UPLOAD ERR {pid}: {r.status_code} {r.json().get('code')}"); return (pid, "upload-err")
    except Exception as e:
        logline(f"UPLOAD EXC {pid}: {type(e).__name__}"); return (pid, "exc")


def cmd_run(a):
    data = json.load(open(a.manifest, encoding="utf-8"))
    if a.only:
        ids = set(int(x) for x in a.only.split(","))
        data = [e for e in data if e["id"] in ids]
    logline(f"=== RUN {len(data)} товаров, {a.workers} воркеров ===")
    bal0 = k.balance()
    res = {}
    with ThreadPoolExecutor(max_workers=a.workers) as ex:
        futs = {ex.submit(process, e, a.force): e["id"] for e in data}
        for fu in as_completed(futs):
            pid, st = fu.result(); res[pid] = st
    bal1 = k.balance()
    summ = {}
    for st in res.values(): summ[st] = summ.get(st, 0) + 1
    logline(f"=== ИТОГ: {summ} | KIE потрачено {bal0-bal1:.0f} cr (~${(bal0-bal1)*k.USD_PER_CREDIT:.2f}) ===")


def main():
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("source"); s.add_argument("--brand", required=True); s.add_argument("--out", required=True)
    s.add_argument("--max-existing", type=int, default=1, dest="max_existing"); s.set_defaults(fn=cmd_source)
    s = sub.add_parser("run"); s.add_argument("--manifest", required=True); s.add_argument("--workers", type=int, default=4)
    s.add_argument("--only"); s.add_argument("--force", action="store_true"); s.set_defaults(fn=cmd_run)
    a = p.parse_args(); a.fn(a)


if __name__ == "__main__":
    main()
