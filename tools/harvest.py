# coding: utf-8
"""Сбор кандидатов фото (raw) по брендам из xlsx → .firecrawl/cand/<pid>_<n>.jpg для ручной проверки.
НЕ заливает. Только качает, чтобы Claude глазами выбрал верное/чистое."""
import sys, os, re, time, requests
sys.path.insert(0, 'tools')
import woo, brand_dark as bd
import openpyxl

XLSX = r"C:\Users\avsou\Downloads\Копия склад  (6).xlsx"
OUT = ".firecrawl/cand"
os.makedirs(OUT, exist_ok=True)


def brands_from_xlsx(targets):
    wb = openpyxl.load_workbook(XLSX, read_only=True, data_only=True)
    ws = wb.active
    brand = None
    items = []
    for r in ws.iter_rows(values_only=True):
        c = [x for x in r if x not in (None, '')]
        if len(c) == 1 and isinstance(c[0], str):
            brand = c[0].strip()
        elif brand and len(r) > 4 and r[4]:
            if any(t.lower() in brand.lower() for t in targets):
                items.append((brand, str(r[4]).strip()))
    return items


def match_woo(name):
    """Найти id товара на сайте по названию (по последним значимым токенам модели)."""
    r = woo._req("GET", "/products", params={"search": name, "per_page": 5}).json()
    if not r:
        return None
    return r[0]["id"]


def main():
    targets = sys.argv[1:] or ["Audio Nova", "DUDU", "Blaupunkt", "Harman"]
    items = brands_from_xlsx(targets)
    print(f"товаров в xlsx: {len(items)}")
    for brand, name in items:
        pid = match_woo(name)
        if not pid:
            print(f"SKIP нет на сайте: {name}"); continue
        q = re.sub(r'^(Усилитель|Сабвуфер|Магнитола|Камера|Компонентная акустика|Коаксиальная акустика|Сабвуфер в запаску)\s+', '', name).strip()
        urls = bd.brave(q + " купить автозвук", 8)
        n = 0
        for u in urls[:6]:
            for img in bd._imgs_from_page(u, 3):
                try:
                    os.replace(img, f"{OUT}/{pid}_{n}.jpg"); n += 1
                except Exception:
                    pass
                if n >= 4:
                    break
            if n >= 4:
                break
        print(f"{pid} | {name} | кандидатов {n}", flush=True)
    print("=== HARVEST ГОТОВ ===")


if __name__ == "__main__":
    main()
