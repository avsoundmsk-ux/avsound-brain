#!/usr/bin/env python3
"""
auto_fill.py — авто-прогон фото по товарам без фото.
Brave-поиск → эвристика отсева мусора → тёмный фон → заливка. Лог.
Утром Михаил пробегается и бракует что не так.

Эвристика «годное фото товара» (на стоке обычно белый фон + предмет по центру):
 - размер >= 500px, пропорции 0.55..1.8 (отсекает баннеры/лого-полоски)
 - доля near-white пикселей 0.30..0.90 (лого=почти весь белый >0.9 reject; инсталл/лайфстайл/тёмный фон <0.3 reject)
 - в центре есть не-белый предмет (центр темнее краёв)
Не ловит: чужой водяной знак на белом, неверную модель. Это ловит человек при ревью.
"""
import sys, os, re, time, json
sys.path.insert(0, os.path.dirname(__file__))
import brand_dark as bd
import woo, dark_bg
from PIL import Image

LOG = "media/generated/auto_fill_log.md"
SKIP_RE = re.compile(r'коробк|подиум|проставк|рамк|кольц|короб|\d+\"|\d+ дюйм|business|Lada|Toyota|Kia|Hyundai|Mitsubishi|Gazelle|Vesta|2109|H-1|land cruiser|Sportage|Highlander|Lancer|X-ray|готов|изготовл|на заказ', re.I)


def log(s):
    print(s, flush=True)
    open(LOG, "a", encoding="utf-8").write(time.strftime("%H:%M:%S ") + s + "\n")


def good_photo(path):
    try:
        im = Image.open(path).convert("RGB")
    except Exception:
        return False
    w, h = im.size
    if w < 500 or h < 500:
        return False
    ar = w / h
    if ar < 0.55 or ar > 1.8:
        return False
    small = im.resize((80, 80))
    px = list(small.getdata())
    n = len(px)
    white = sum(1 for r, g, b in px if r > 235 and g > 235 and b > 235)
    wf = white / n
    if wf < 0.30 or wf > 0.90:
        return False
    # центр должен содержать предмет (не белый): доля не-белого в центре выше краёв
    cen = small.crop((24, 24, 56, 56)); cpx = list(cen.getdata())
    cwhite = sum(1 for r, g, b in cpx if r > 235 and g > 235 and b > 235) / len(cpx)
    if cwhite > 0.6:   # центр почти белый → нет предмета по центру
        return False
    return True


def pick(name):
    q = re.sub(r'^(Усилитель|Сабвуфер|Процессорный усилитель|Моноблок|Преобразователь|Пульт управления|Компонентная акустика|Коаксиальная акустика|Среднечастотная акустика|Твитеры?|Твитера|Магнитола|Камера|Активный сабвуфер)\s+', '', name).strip()
    for u in bd.brave(q + " купить", 8)[:6]:
        for img in bd._imgs_from_page(u, 3):
            if good_photo(img):
                return img
    return None


def main():
    data = json.load(open(".firecrawl/empty.json", encoding="utf-8"))
    todo = [(i, n) for i, n in data if not SKIP_RE.search(n)]
    # пропустить уже сделанные (есть фото сейчас)
    log(f"=== AUTO_FILL старт: кандидатов {len(todo)} ===")
    ok = skip = 0
    for pid, name in todo:
        try:
            cur = woo._req("GET", f"/products/{pid}").json()
            if cur.get("images"):
                continue
        except Exception:
            pass
        try:
            src = pick(name)
        except Exception as e:
            log(f"SKIP {pid} {name}: ошибка поиска {type(e).__name__}"); skip += 1; continue
        if not src:
            log(f"SKIP {pid} {name}: нет годного фото"); skip += 1; continue
        try:
            out = f"media/generated/af_{pid}.png"
            dark_bg.run(src, out)
            r = woo._req("PUT", f"/products/{pid}", json={"images": [{"src": woo.upload_tmp(out)}]})
            if r.status_code == 200:
                log(f"OK {pid} {name}"); ok += 1
            else:
                log(f"ERR {pid} {name}: {r.status_code}"); skip += 1
        except Exception as e:
            log(f"EXC {pid} {name}: {type(e).__name__}"); skip += 1
    log(f"=== ИТОГ: залито {ok}, пропущено {skip} ===")


if __name__ == "__main__":
    main()
