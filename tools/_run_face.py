#!/usr/bin/env python3
"""Разовый face/body transfer через KIE Nano Banana Edit."""
import sys, os, json, time, re, datetime, urllib.request
sys.path.insert(0, os.path.dirname(__file__))
import kie_gen as k

FRIEND = r"C:\Users\avsou\Downloads\Telegram Desktop\photo_2026-06-19_00-23-10.jpg"   # лицо+телосложение
SCENE  = r"C:\Users\avsou\Downloads\Telegram Desktop\photo_2026-06-18_22-15-23.jpg"   # офис/поза

PROMPT = (
    "FACE AND IDENTITY SWAP. In the office scene (second image), completely REPLACE the seated asian man "
    "with the man from the FIRST image — the smiling European man wearing a camouflage jacket. "
    "The final person MUST have the EXACT face, head shape, hairstyle and heavier/fuller body build of the "
    "man from the first image, fully recognizable. Do NOT keep any features of the original asian man. "
    "He now sits at the glass office desk wearing a well-tailored grey business suit, white shirt and tie, "
    "in the same confident pose, same camera angle and same bright window lighting as the office photo. "
    "Make the suit fit his real heavier body type naturally. Photorealistic high-end corporate portrait, "
    "sharp focus, natural skin texture, European facial features, rounder fuller face. The result must "
    "clearly be the man from the first image, NOT the original man."
)


def main():
    bal = k.balance()
    print(f"Баланс: {bal} cr (~${bal*k.USD_PER_CREDIT:.2f})")
    print("Заливаю фото друга...")
    u_friend = k.upload_file(FRIEND, "avsound/face")
    print("  ->", u_friend)
    print("Заливаю фото-сцену...")
    u_scene = k.upload_file(SCENE, "avsound/face")
    print("  ->", u_scene)

    inp = {"prompt": PROMPT, "image_urls": [u_friend, u_scene], "output_format": "png"}
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
