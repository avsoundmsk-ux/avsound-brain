#!/usr/bin/env python3
"""Разовый face/body transfer через KIE Nano Banana Edit."""
import sys, os, json, time, re, datetime, urllib.request
sys.path.insert(0, os.path.dirname(__file__))
import kie_gen as k

FRIEND = r"C:\Users\avsou\Downloads\Telegram Desktop\photo_2026-06-19_00-23-10.jpg"   # лицо+телосложение
SCENE  = r"C:\Users\avsou\Downloads\Telegram Desktop\photo_2026-06-18_22-15-23.jpg"   # офис/поза

PROMPT = (
    "Professional high-end corporate portrait of THIS exact man. Keep his face, head shape, hairstyle, "
    "skin tone and his fuller/heavier body build 100% identical and clearly recognizable — do not slim him, "
    "do not beautify or change his face. Re-dress him in an elegant well-tailored grey business suit with a "
    "crisp white shirt and a light blue tie that fits his real heavier body naturally. He sits confidently "
    "at a glossy white office desk in a modern bright high-rise office, floor-to-ceiling windows with a "
    "blurred city skyline behind him, a black leather executive chair, shelves with folders. Warm friendly "
    "confident expression, one hand resting on the desk. Photorealistic, high-end soft studio lighting, "
    "sharp focus, natural skin texture, magazine-quality business headshot, 4k."
)


def main():
    bal = k.balance()
    print(f"Баланс: {bal} cr (~${bal*k.USD_PER_CREDIT:.2f})")
    print("Заливаю фото друга...")
    u_friend = k.upload_file(FRIEND, "avsound/face")
    print("  ->", u_friend)
    inp = {"prompt": PROMPT, "image_urls": [u_friend], "output_format": "png"}
    print("Создаю задачу Nano Banana Edit...")
    resp = k._req("POST", k.BASE + "/createTask", {"model": "google/nano-banana-edit", "input": inp})
    task_id = (resp.get("data") or {}).get("taskId")
    if not task_id:
        print("Нет taskId:", resp); sys.exit(1)
    print("taskId:", task_id)

    url = None
    for _ in range(60):
        d = k._req("GET", k.BASE + "/recordInfo?taskId=" + task_id).get("data", {})
        state = str(d.get("state", "")).lower()
        if state in ("success", "completed", "succeed"):
            rj = d.get("resultJson")
            if isinstance(rj, str):
                try:
                    urls = json.loads(rj).get("resultUrls") or json.loads(rj).get("urls")
                    if urls: url = urls[0]
                except Exception: pass
            if not url:
                m = re.search(r"https?://[^\s\"']+\.(png|jpg|jpeg|webp)", json.dumps(d))
                url = m.group(0) if m else None
            break
        if state in ("fail", "failed", "error"):
            print("Упало:", json.dumps(d)[:600]); sys.exit(1)
        print("  ...", state or "wait"); time.sleep(5)

    if not url:
        print("URL не найден."); sys.exit(1)
    print("Картинка:", url)
    os.makedirs(k.OUT_DIR, exist_ok=True)
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    path = os.path.join(k.OUT_DIR, f"face_{ts}.png")
    rq = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0 Safari/537.36"})
    with urllib.request.urlopen(rq, timeout=120) as r, open(path, "wb") as out:
        out.write(r.read())
    print("Сохранено:", os.path.abspath(path))
    b = k.balance(); print(f"Остаток: {b} cr (~${b*k.USD_PER_CREDIT:.2f})")


if __name__ == "__main__":
    main()
