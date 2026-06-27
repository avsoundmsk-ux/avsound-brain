#!/usr/bin/env python3
"""
cat_images.py — обложки категорий каталога в едином тёмном стиле.
Для каждой категории без картинки:
 1) берём фото товара-члена, уже сделанного в нашем тёмном стиле (URL содержит af_/db_/kie/bf2/fx3/dark) — единый вид;
 2) если нет — Brave по названию категории → тёмный фон.
Ставит изображение категории через WC API (PUT /products/categories/<id>).
"""
import sys, os, re, time
sys.path.insert(0, os.path.dirname(__file__))
import woo, dark_bg, brand_dark as bd

LOG = "media/generated/cat_images_log.md"
DARK = re.compile(r'/(af_|db_|kie|bf2|fx3|f47|r47|volt|ik_|uno_|due_|m9_)')


def log(s):
    print(s, flush=True)
    open(LOG, "a", encoding="utf-8").write(time.strftime("%H:%M:%S ") + s + "\n")


def member_dark_photo(cat_id):
    """URL фото товара-члена в нашем тёмном стиле, если есть."""
    r = woo._req("GET", "/products", params={"category": cat_id, "per_page": 40})
    cand = None
    for p in r.json():
        for im in p.get("images", []):
            src = im.get("src", "")
            if DARK.search(src):
                return src       # наш стиль — берём сразу
            if not cand and src:
                cand = src       # запасной любой
    return cand


def main():
    cats = woo._req("GET", "/products/categories", params={"per_page": 100}).json()
    todo = [c for c in cats if not c.get("image") and c.get("count", 0) > 0]
    log(f"=== CAT_IMAGES: категорий без обложки {len(todo)} ===")
    ok = skip = 0
    for c in todo:
        cid, name = c["id"], c["name"]
        src = member_dark_photo(cid)
        try:
            if src:
                # переложить через tmpfiles (свежий стабильный URL) и поставить
                # уже на сайте — можно дать src напрямую
                r = woo._req("PUT", f"/products/categories/{cid}", json={"image": {"src": src}})
                if r.status_code in (200, 201):
                    log(f"OK {cid} {name} (фото товара)"); ok += 1; continue
                log(f"ERR {cid} {name}: {r.status_code} {r.json().get('code')}")
            # фолбэк: поиск по названию
            q = re.sub(r'[^\w\s-]', '', name)
            got = None
            for u in bd.brave(q + " автозвук купить", 6)[:5]:
                imgs = bd._imgs_from_page(u, 2)
                if imgs:
                    got = imgs[0]; break
            if not got:
                log(f"SKIP {cid} {name}: нет фото"); skip += 1; continue
            out = f"media/generated/cat_{cid}.png"; dark_bg.run(got, out)
            r = woo._req("PUT", f"/products/categories/{cid}", json={"image": {"src": woo.upload_tmp(out)}})
            log(f"OK {cid} {name} (поиск)" if r.status_code in (200, 201) else f"ERR {cid} {name}: {r.status_code}")
            ok += r.status_code in (200, 201); skip += r.status_code not in (200, 201)
        except Exception as e:
            log(f"EXC {cid} {name}: {type(e).__name__}"); skip += 1
    log(f"=== ИТОГ: обложек {ok}, пропущено {skip} ===")


if __name__ == "__main__":
    main()
