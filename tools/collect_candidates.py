#!/usr/bin/env python3
"""
collect_candidates.py — собрать НЕСКОЛЬКО фото-кандидатов на товар для ручной визуальной проверки.

Не доверяет авто-матчингу. Тащит много вариантов с разных страниц (pride.audio, shop-bear,
loudsound) → candidates_pride.json. Дальше montage.py клеит подписанные листы, человек выбирает
верный кадр, choose.py пишет его в manifest.

Пример:
  python tools/collect_candidates.py --manifest manifest_pride.json --out candidates_pride.json
"""
import argparse, json, os, re, subprocess, sys, tempfile
from urllib.parse import unquote
sys.path.insert(0, os.path.dirname(__file__))
import woo_batch as wb

PAGE_PATS = [
    re.compile(r'https://pride\.audio/(?:ru/)?product/[^\s)"\']+'),
    re.compile(r'https://shop-bear\.ru/catalog/\S+?/[^\s)"\']+/'),
    re.compile(r'https://loudsound\.ru/catalog/\S+?/[^\s)"\']+/'),
]


def search_pages(name, limit=4):
    tmp = tempfile.mktemp(suffix=".md")
    try:
        subprocess.run(f'firecrawl search "{name}" -o "{tmp}"',
                       shell=True, capture_output=True, timeout=90)
    except subprocess.TimeoutExpired:
        return []
    if not os.path.exists(tmp):
        return []
    txt = open(tmp, encoding="utf-8", errors="ignore").read()
    os.remove(tmp)
    pages = []
    for pat in PAGE_PATS:
        for m in pat.finditer(txt):
            u = m.group(0).rstrip(').,"\'')
            if u not in pages:
                pages.append(u)
    return pages[:limit]


def page_images(page):
    """og:image + крупные картинки со страницы (галерея товара)."""
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
    urls = []
    m = re.search(r'property=["\']og:image["\'][^>]+content=["\']([^"\']+)', html)
    if m:
        urls.append(m.group(1).replace("&#038;", "&"))
    urls += re.findall(r'https://[^\s"\']+/wp-content/uploads/[^\s"\']+?\.(?:jpg|jpeg|png|webp)', html)
    urls += re.findall(r'https://[^\s"\']+/upload/iblock/[^\s"\']+?\.(?:jpg|jpeg|png)', html)
    seen, out = set(), []
    for u in urls:
        u = u.replace("&#038;", "&")
        if u in seen:
            continue
        seen.add(u)
        low = u.lower()
        if any(b in low for b in ("logo", "placeholder", "resize_cache", "icon", "/flags/", "sprite")):
            continue
        out.append(u)
    return out


def collect(entry, max_imgs=6):
    name = (entry.get("name") or "").strip()
    if not name:
        return {"id": entry["id"], "name": name, "urls": [], "pages": []}
    pages = search_pages(name)
    urls = []
    for p in pages:
        for u in page_images(p):
            if u not in urls and wb.big_enough(u, minpx=500):
                urls.append(u)
            if len(urls) >= max_imgs:
                break
        if len(urls) >= max_imgs:
            break
    wb.logline(f"cand {entry['id']} {name}: {len(urls)} кандидатов из {len(pages)} стр.")
    return {"id": entry["id"], "name": name, "urls": urls, "pages": pages}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--only")
    a = ap.parse_args()
    data = json.load(open(a.manifest, encoding="utf-8"))
    only = set(int(x) for x in a.only.split(",")) if a.only else None
    todo = [e for e in data if not e.get("sources") and (only is None or e["id"] in only)]
    wb.logline(f"=== COLLECT: {len(todo)} товаров ===")
    out = []
    for e in todo:
        out.append(collect(e))
        json.dump(out, open(a.out, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    wb.logline(f"=== COLLECT ИТОГ: {sum(1 for x in out if x['urls'])}/{len(out)} с кандидатами ===")


if __name__ == "__main__":
    main()
