# coding: utf-8
"""
brand_fix.py — автономная пересборка фото для списка товаров.
firecrawl SEARCH (быстрый, надёжный) → shop-bear URL → direct requests (надёжный) →
галерея → KIE тёмная студия (авто-перегон при светлом фоне) → заливка заменой (чистит старое).
Лог: media/generated/brandfix_log.md
"""
import re, os, sys, time, json, subprocess, tempfile, requests
from PIL import Image
from io import BytesIO
sys.path.insert(0, os.path.dirname(__file__))
import woo, kie_product_photo as kp

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0"}
LOG = "media/generated/brandfix_log.md"

def log(s):
    print(s, flush=True)
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(time.strftime("%H:%M:%S ") + s + "\n")

def get(u, t=6):
    for _ in range(t):
        try:
            r = requests.get(u, timeout=35, headers=UA)
            if r.status_code == 200:
                return r
        except Exception:
            pass
        time.sleep(3)
    return None

def find_shopbear(query):
    tmp = tempfile.mktemp(suffix=".md")
    try:
        subprocess.run(f'firecrawl search "{query} shop-bear" -o "{tmp}"', shell=True,
                       capture_output=True, timeout=90)
    except Exception:
        return None
    if not os.path.exists(tmp):
        return None
    t = open(tmp, encoding="utf-8", errors="ignore").read(); os.remove(tmp)
    urls = re.findall(r'https://shop-bear\.ru/catalog/[a-z0-9/_-]+/', t)
    # товар = >=4 сегментов после домена (категория = 3); самые длинные первыми
    prod = [u for u in dict.fromkeys(urls) if u.rstrip('/').count('/') >= 6]
    return prod or list(dict.fromkeys(urls))

def gallery(url, n=3):
    r = get(url)
    if not r:
        return []
    html = r.text
    cand = []
    m = re.search(r'og:image"[^>]*content="([^"]+)', html) or re.search(r'content="([^"]+)"[^>]*og:image', html)
    if m:
        s = m.group(1)
        if not s.startswith("http"):
            s = "https://shop-bear.ru" + s
        if "logo" not in s.lower() and "/CMax/" not in s:
            cand.append(s)
    for u in dict.fromkeys(re.findall(r'/upload/iblock/[\w./-]+?\.(?:jpg|jpeg|png)', html)):
        if "resize_cache" in u:
            continue
        cand.append("https://shop-bear.ru" + u)
    out = []
    seen = set()
    for u in cand:
        if u in seen:
            continue
        seen.add(u)
        d = get(u)
        if not d:
            continue
        try:
            if Image.open(BytesIO(d.content)).size[0] >= 500:
                p = f".firecrawl/bf_{abs(hash(u))%10**8}.jpg"
                open(p, "wb").write(d.content); out.append(p)
        except Exception:
            pass
        if len(out) >= n:
            break
    return out

def too_light(png):
    im = Image.open(png).convert("L"); w, h = im.size
    s = im.crop((0, 0, w, int(h * 0.06)))
    d = list(s.getdata())
    return sum(d) / len(d) > 110

def studio(src, out, ptype, tries=3):
    for _ in range(tries):
        try:
            kp.run(src, out, hero=True, ptype=ptype)
            if not too_light(out):
                return True
        except Exception:
            time.sleep(3)
    return os.path.exists(out)

def process(pid, query, ptype):
    urls = find_shopbear(query) or []
    imgs = []
    for url in urls[:4]:
        imgs = gallery(url, 3)
        if imgs:
            break
    if not imgs:
        log(f"FAIL {pid} {query}: нет фото ({urls[:2]})"); return False
    outs = []
    for i, src in enumerate(imgs):
        o = f"media/generated/bf_{pid}_{i}.png"
        if studio(src, o, ptype):
            outs.append(o)
    if not outs:
        log(f"FAIL {pid} {query}: KIE не дал результат"); return False
    try:
        up = [{"src": woo.upload_tmp(o)} for o in outs]
        r = woo._req("PUT", f"/products/{pid}", json={"images": up})
        if r.status_code == 200:
            log(f"OK {pid} {query}: {len(up)} фото"); return True
        log(f"UPLOAD-ERR {pid}: {r.status_code}"); return False
    except Exception as e:
        log(f"UPLOAD-EXC {pid}: {type(e).__name__}"); return False

# (pid, поисковый запрос, тип для KIE)
ITEMS = [
 (42269,"Hellion HAM 4.6pin DSP","a car audio DSP processor amplifier"),
 (42277,"Hellion HAM 4.8pin DSP","a car audio DSP processor amplifier"),
 (42279,"Hellion HAM 8.10 DSP","a car audio DSP processor amplifier"),
 (42268,"Hellion HAM 6.80 DSP","a car audio DSP processor amplifier"),
 (42291,"Hellion HAM 8.80 DSP","a car audio DSP processor amplifier"),
 (42289,"Hellion HAM 8.100 DSP","a car audio DSP processor amplifier"),
 (42293,"Hellion HAM 12.80 DSP","a car audio DSP processor amplifier"),
 (42271,"Hellion HAM 16.150 DSP","a car audio DSP processor amplifier"),
 (42295,"Hellion HAM 800.2D","a car audio amplifier"),
 (42281,"Hellion HAM 1000.2D Optical","a car audio amplifier"),
 (42297,"Hellion HAM 150.4D","a car audio amplifier"),
 (42287,"Hellion HAM 450.4D","a car audio amplifier"),
 (42273,"Hellion HAM 500.4D Optical","a car audio amplifier"),
 (42299,"Hellion HAM 450.1D","a car audio monoblock amplifier"),
 (42301,"Hellion HAM 500.1D Optical","a car audio monoblock amplifier"),
 (42285,"Hellion HAM 1000.1SQ","a car audio monoblock amplifier"),
 (42303,"Hellion DHL-6 преобразователь","a car audio line output converter"),
 (42283,"Hellion DHL-6 PRO преобразователь","a car audio line output converter"),
 (42305,"Hellion DHL-10 преобразователь","a car audio line output converter"),
 (42275,"Hellion DRC-DSD 256 пульт","a car audio remote control knob"),
 (42307,"Hellion DRC-2 пульт","a car audio remote control knob"),
 (42309,"Hellion DRC-LCD пульт","a car audio remote control knob"),
 (41477,"Helix Ci3 W165FM-S3","a car audio component speaker"),
 (41478,"Helix IK S12 DVC2","a car audio subwoofer speaker driver"),
 (41479,"Helix IK W12 DVC2","a car audio subwoofer speaker driver"),
 (41480,"Helix IK W10 DVC2","a car audio subwoofer speaker driver"),
 (41481,"Helix IK S10 DVC2","a car audio subwoofer speaker driver"),
 (41482,"Helix DSP.3S процессор","a car audio DSP processor"),
 (41483,"Helix M ONE X усилитель","a car audio monoblock amplifier"),
 (41484,"Helix URC.3 пульт","a car audio remote control knob"),
 (41485,"Helix Impact terminal","a car audio terminal accessory"),
]

def main():
    os.makedirs("media/generated", exist_ok=True)
    os.makedirs(".firecrawl", exist_ok=True)
    only = set(int(x) for x in sys.argv[1].split(",")) if len(sys.argv) > 1 else None
    items = [it for it in ITEMS if not only or it[0] in only]
    log(f"=== START {len(items)} товаров ===")
    ok = 0
    for pid, q, t in items:
        try:
            if process(pid, q, t):
                ok += 1
        except Exception as e:
            log(f"EXC {pid}: {type(e).__name__}")
    log(f"=== ИТОГ: {ok}/{len(items)} ===")

if __name__ == "__main__":
    main()
