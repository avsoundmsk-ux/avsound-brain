#!/usr/bin/env python3
"""
woo.py — агент для сайта av-sound.ru (WooCommerce REST API).

Разблокирует автоматизацию каталога: поиск товара, заливка фото, обновление
цены / описания / характеристик / SEO-полей. Без сторонних зависимостей кроме
requests (и Pillow — только для подготовки фото в пайплайне photo).

Ключи WooCommerce берутся из env или из памяти api-keys (захардкожен fallback).
Сеть нестабильна (VPN) → все запросы с ретраями.

Примеры:
  python tools/woo.py find "Uno plus"
  python tools/woo.py get 41560
  python tools/woo.py set-price 41560 11500
  python tools/woo.py set-desc 41560 --file desc.html
  python tools/woo.py set-attr 41560 "Мощность RMS=700 Вт" "Каналы=1"
  python tools/woo.py set-seo 41560 --title "..." --desc "..."
  python tools/woo.py set-images 41560 a.png b.png c.png
  python tools/woo.py photo 41560 source.jpg --type "a car audio amplifier" --hero
"""
import argparse, json, os, sys, time, mimetypes
import requests

CK = os.environ.get("WOO_CK", "ck_3b8d45987f4bbfe31db68a6349a720dd437ab237")
CS = os.environ.get("WOO_CS", "cs_266353030e15120bddfed93ff4c51936b59a53be")
BASE = "https://av-sound.ru/wp-json/wc/v3"
AUTH = (CK, CS)
RETRIES = 6
TIMEOUT = 120


def _req(method, path, **kw):
    """Запрос к WC API с ретраями на сетевые сбои (VPN рвёт соединение)."""
    url = path if path.startswith("http") else BASE + path
    last = None
    for a in range(RETRIES):
        try:
            r = requests.request(method, url, auth=AUTH, timeout=TIMEOUT, **kw)
            return r
        except requests.exceptions.RequestException as e:
            last = e
            print(f"  [сеть] повтор {a+1}/{RETRIES}: {type(e).__name__}", file=sys.stderr)
            time.sleep(4)
    raise last


# ---------- временный хостинг для фото (WC скачивает src к себе) ----------
def upload_tmp(path):
    """Залить локальный файл на tmpfiles.org → прямой URL для WC src."""
    for a in range(RETRIES):
        try:
            with open(path, "rb") as f:
                r = requests.post("https://tmpfiles.org/api/v1/upload",
                                  files={"file": (os.path.basename(path), f)}, timeout=60)
            u = r.json()["data"]["url"]
            return u.replace("tmpfiles.org/", "tmpfiles.org/dl/")
        except Exception as e:
            print(f"  [tmp] повтор {a+1}: {type(e).__name__}", file=sys.stderr)
            time.sleep(3)
    raise RuntimeError("tmpfiles upload failed: " + path)


# ---------------------------- команды ----------------------------
def cmd_find(a):
    r = _req("GET", "/products", params={"search": a.query, "per_page": a.limit})
    for p in r.json():
        print(f"{p['id']}\t{p['name']}\tцена:{p.get('price','-')}\tфото:{len(p.get('images',[]))}")


def cmd_get(a):
    r = _req("GET", f"/products/{a.id}")
    p = r.json()
    print(json.dumps({
        "id": p.get("id"), "name": p.get("name"), "sku": p.get("sku"),
        "price": p.get("price"), "regular_price": p.get("regular_price"),
        "stock": p.get("stock_quantity"), "categories": [c["name"] for c in p.get("categories", [])],
        "images": [i["src"] for i in p.get("images", [])],
        "attributes": [{a2["name"]: a2.get("options")} for a2 in p.get("attributes", [])],
    }, ensure_ascii=False, indent=2))


def cmd_set_price(a):
    r = _req("PUT", f"/products/{a.id}", json={"regular_price": str(a.price)})
    _show(r, "цена")


def cmd_set_desc(a):
    text = open(a.file, encoding="utf-8").read() if a.file else a.text
    field = "short_description" if a.short else "description"
    r = _req("PUT", f"/products/{a.id}", json={field: text})
    _show(r, field)


def cmd_set_attr(a):
    """Характеристики как глобальные/локальные атрибуты товара (видны в табе 'Характеристики')."""
    attrs = []
    for i, kv in enumerate(a.pairs):
        name, _, val = kv.partition("=")
        attrs.append({"name": name.strip(), "position": i, "visible": True,
                      "options": [v.strip() for v in val.split("|")]})
    r = _req("PUT", f"/products/{a.id}", json={"attributes": attrs})
    _show(r, "характеристики")


def cmd_set_seo(a):
    """SEO-поля через meta_data. Поддержка Rank Math, Yoast и SiteSEO ключей сразу."""
    meta = []
    if a.title:
        meta += [{"key": "rank_math_title", "value": a.title},
                 {"key": "_yoast_wpseo_title", "value": a.title},
                 {"key": "_siteseo_meta_title", "value": a.title}]
    if a.desc:
        meta += [{"key": "rank_math_description", "value": a.desc},
                 {"key": "_yoast_wpseo_metadesc", "value": a.desc},
                 {"key": "_siteseo_meta_description", "value": a.desc}]
    if a.focus:
        meta += [{"key": "rank_math_focus_keyword", "value": a.focus},
                 {"key": "_yoast_wpseo_focuskw", "value": a.focus}]
    r = _req("PUT", f"/products/{a.id}", json={"meta_data": meta})
    _show(r, "SEO")


def cmd_set_images(a):
    """Залить локальные фото и поставить товару (порядок = главное первым)."""
    imgs = []
    for f in a.files:
        if f.startswith("http"):
            imgs.append({"src": f})
        else:
            u = upload_tmp(f)
            print("  загружено:", os.path.basename(f), "->", u)
            imgs.append({"src": u})
    r = _req("PUT", f"/products/{a.id}", json={"images": imgs})
    _show(r, "фото")


def cmd_photo(a):
    """Полный пайплайн: исходное фото → KIE тёмная студия → залить товару."""
    sys.path.insert(0, os.path.dirname(__file__))
    import kie_product_photo as kp
    out = a.out or os.path.join("media", "generated", f"woo_{a.id}.png")
    kp.run(a.src, out, hero=a.hero, ptype=a.type)
    u = upload_tmp(out)
    print("  загружено:", u)
    extra = [{"src": upload_tmp(f)} for f in a.extra] if a.extra else []
    r = _req("PUT", f"/products/{a.id}", json={"images": [{"src": u}] + extra})
    _show(r, "фото (KIE)")


def _show(r, what):
    if r.status_code == 200:
        d = r.json()
        if what == "фото" or what.startswith("фото"):
            print("OK:", [i["src"] for i in d.get("images", [])])
        else:
            print(f"OK [{what}] id={d.get('id')} {d.get('name')}")
    else:
        try:
            print(f"ОШИБКА {r.status_code} [{what}]:", r.json().get("code"), r.json().get("message"))
        except Exception:
            print(f"ОШИБКА {r.status_code} [{what}]:", r.text[:200])


def main():
    p = argparse.ArgumentParser(description="Агент av-sound.ru / WooCommerce")
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("find"); s.add_argument("query"); s.add_argument("--limit", type=int, default=15); s.set_defaults(fn=cmd_find)
    s = sub.add_parser("get"); s.add_argument("id"); s.set_defaults(fn=cmd_get)
    s = sub.add_parser("set-price"); s.add_argument("id"); s.add_argument("price"); s.set_defaults(fn=cmd_set_price)
    s = sub.add_parser("set-desc"); s.add_argument("id"); s.add_argument("text", nargs="?"); s.add_argument("--file"); s.add_argument("--short", action="store_true"); s.set_defaults(fn=cmd_set_desc)
    s = sub.add_parser("set-attr"); s.add_argument("id"); s.add_argument("pairs", nargs="+", help="'Имя=Значение' или 'Имя=Зн1|Зн2'"); s.set_defaults(fn=cmd_set_attr)
    s = sub.add_parser("set-seo"); s.add_argument("id"); s.add_argument("--title"); s.add_argument("--desc"); s.add_argument("--focus"); s.set_defaults(fn=cmd_set_seo)
    s = sub.add_parser("set-images"); s.add_argument("id"); s.add_argument("files", nargs="+"); s.set_defaults(fn=cmd_set_images)
    s = sub.add_parser("photo"); s.add_argument("id"); s.add_argument("src"); s.add_argument("--out"); s.add_argument("--type", default="a car audio product"); s.add_argument("--hero", action="store_true"); s.add_argument("--extra", nargs="*"); s.set_defaults(fn=cmd_photo)

    a = p.parse_args()
    a.fn(a)


if __name__ == "__main__":
    main()
