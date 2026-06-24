#!/usr/bin/env python3
"""
fill_sources.py — добрать фото-источники для товаров с пустым sources в manifest.

shop-bear часто не находит. Этот скрипт ищет на офиц. pride.audio (фото без чужих
водяных знаков, белый фон — идеально для KIE), с фолбэком на shop-bear/loudsound.

Обновляет manifest на месте (инкрементально). clean_wm ставится по домену источника:
pride.audio = False (нет чужого знака), shop-bear = True (знак в углу).

Пример:
  python tools/fill_sources.py --manifest manifest_pride.json
  python tools/fill_sources.py --manifest manifest_pride.json --only 41520,41519
"""
import argparse, json, os, re, subprocess, sys, tempfile
sys.path.insert(0, os.path.dirname(__file__))
import woo_batch as wb

# домены-источники в порядке предпочтения: (паттерн URL товарной страницы, clean_wm)
SOURCES = [
    (re.compile(r'https://pride\.audio/(?:ru/)?product/[^\s)"\']+'), False),
    (re.compile(r'https://shop-bear\.ru/catalog/\S+/'), True),
    (re.compile(r'https://loudsound\.ru/\S+?/[^\s)"\']+'), True),
]


STOP = {"pride", "car", "audio", "колба", "динамики", "сабвуфер", "усилитель",
        "моноблок", "комплект", "ver", "competition", "pro", "the", "for", "и", "для", "м"}


def model_tokens(name):
    """Различающие токены модели: числа и буквенно-цифровые коды (uno, m.9, s.4, solo 300, 1024)."""
    n = name.lower().replace("ё", "е")
    toks = re.findall(r'[a-zа-я]+\.?\d+|\d+|[a-z]{2,}', n)
    return [t for t in toks if t not in STOP and len(t) >= 2]


def find_page(name):
    """firecrawl search → товарная страница, у которой URL содержит токен модели (гард от чужого товара)."""
    tmp = tempfile.mktemp(suffix=".md")
    try:
        subprocess.run(f'firecrawl search "{name} pride.audio" -o "{tmp}"',
                       shell=True, capture_output=True, timeout=90)
    except subprocess.TimeoutExpired:
        return None, False
    if not os.path.exists(tmp):
        return None, False
    txt = open(tmp, encoding="utf-8", errors="ignore").read()
    os.remove(tmp)
    toks = model_tokens(name)
    for pat, clean in SOURCES:
        for m in pat.finditer(txt):
            url = m.group(0).rstrip(').,"\'')
            from urllib.parse import unquote
            u = unquote(url).lower()
            # гард: хотя бы один цифровой/модельный токен должен быть в URL страницы
            num = [t for t in toks if any(c.isdigit() for c in t)]
            if num and any(t.replace(".", "").replace(" ", "") in u.replace("-", "").replace("_", "").replace("%", "")
                           for t in num):
                return url, clean
    return None, False


def og_image(page):
    """Главное фото товара из og:image (без карусели похожих)."""
    tmp = tempfile.mktemp(suffix=".html")
    try:
        subprocess.run(f'firecrawl scrape "{page}" --format rawHtml -o "{tmp}"',
                       shell=True, capture_output=True, timeout=90)
    except subprocess.TimeoutExpired:
        return []
    if not os.path.exists(tmp):
        return []
    html = open(tmp, encoding="utf-8", errors="ignore").read()
    os.remove(tmp)
    m = re.search(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)', html)
    return [m.group(1)] if m else []


def fill(entry):
    name = (entry.get("name") or "").strip()
    if not name:
        wb.logline(f"fill SKIP {entry['id']}: пустое имя"); return False
    page, clean = find_page(name)
    if not page:
        wb.logline(f"fill {entry['id']} {name}: подходящая страница не найдена (гард)"); return False
    srcs = [u for u in og_image(page) if wb.big_enough(u)]
    if not srcs:
        wb.logline(f"fill {entry['id']} {name}: og:image не найдено ({page})"); return False
    entry["sources"] = srcs
    entry["clean_wm"] = clean
    entry["type"] = wb.guess_type(name)
    entry["_src_page"] = page
    wb.logline(f"fill {entry['id']} {name}: 1 фото ({'pride.audio' if 'pride.audio' in page else page.split('/')[2]})")
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest", required=True)
    ap.add_argument("--only")
    a = ap.parse_args()
    data = json.load(open(a.manifest, encoding="utf-8"))
    only = set(int(x) for x in a.only.split(",")) if a.only else None
    todo = [e for e in data if not e.get("sources") and (only is None or e["id"] in only)]
    wb.logline(f"=== FILL: {len(todo)} товаров без источников ===")
    got = 0
    for e in todo:
        if fill(e):
            got += 1
        json.dump(data, open(a.manifest, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    wb.logline(f"=== FILL ИТОГ: добрано {got}/{len(todo)} ===")


if __name__ == "__main__":
    main()
