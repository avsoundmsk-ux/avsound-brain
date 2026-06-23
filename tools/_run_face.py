#!/usr/bin/env python3
"""Разовый face/body transfer через KIE Nano Banana Edit."""
import sys, os, json, time, re, datetime, urllib.request
sys.path.insert(0, os.path.dirname(__file__))
import kie_gen as k

FRIEND = r"C:\Users\avsou\Downloads\Telegram Desktop\photo_2026-06-19_00-23-10.jpg"   # лицо+телосложение
SCENE  = r"C:\Users\avsou\Downloads\Telegram Desktop\photo_2026-06-18_22-15-23.jpg"   # офис/поза

PROMPT = (
    "Take the man from the FIRST image (his real face, hairstyle and fuller body build) and place him "
    "into the elegant office scene from the SECOND image. He sits confidently at the glass office desk "
    "in the same pose, same camera angle and same bright window lighting as the second image. "
    "Dress him in a well-tailored modern business suit with a white shirt and a tie, fitting his real "
    "heavier body type naturally. CRITICAL: keep his face 100% unchanged and clearly recognizable, do not "
    "slim or beautify the face, do not change his ethnicity. Photorealistic high-end corporate portrait, "
    "sharp focus, professional studio quality, natural skin texture."
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
    urllib.request.urlretrieve(url, path)
    print("Сохранено:", os.path.abspath(path))
    b = k.balance(); print(f"Остаток: {b} cr (~${b*k.USD_PER_CREDIT:.2f})")


if __name__ == "__main__":
    main()
