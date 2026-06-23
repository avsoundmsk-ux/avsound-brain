#!/usr/bin/env python3
"""Разовый генератор продающего ролика AVSound через KIE Seedance 2 (video-to-video)."""
import sys, os, datetime
sys.path.insert(0, os.path.dirname(__file__))
import kie_gen as k

VIDEOS = [
    r"C:\Users\avsou\Downloads\Telegram Desktop\video_2026-06-22_21-29-21.mp4",
    r"C:\Users\avsou\Downloads\Telegram Desktop\video_2026-06-22_21-29-26.mp4",
    r"C:\Users\avsou\Downloads\Telegram Desktop\IMG_5811.MOV",
]

PROMPT = (
    "Cinematic vertical promo reel for a premium car audio installation studio. "
    "Dynamic showcase of high-end car audio: powerful black amplifiers mounted cleanly in a car trunk, "
    "subwoofers pulsing and vibrating to deep bass, premium component speakers, a modern showroom wall "
    "packed with head units and electronics under spotlights. Smooth fast camera push-ins, slow-motion "
    "bass vibrations, dramatic dark lighting with red and neon accents, glossy reflective surfaces, "
    "sense of raw power and expert craftsmanship. Confident premium brand energy, professional commercial "
    "advertising look, high production value. Native audio: deep punchy bass music with hard sub-bass drops."
)

RES = "720p"
DUR = 10
ASPECT = "9:16"


def main():
    bal = k.balance()
    cr, usd = k.estimate(RES, "i2v", DUR)
    print(f"Баланс: {bal} cr (~${bal*k.USD_PER_CREDIT:.2f}) | оценка: ~{cr:.0f} cr (~${usd:.2f})")
    if cr > bal:
        print("Не хватает кредитов."); sys.exit(1)

    refs = []
    for v in VIDEOS:
        if not os.path.exists(v):
            print("Пропуск (нет файла):", v); continue
        print("Заливаю:", os.path.basename(v))
        try:
            url = k.upload_file(v, "avsound/refs")
            print("  ->", url); refs.append(url)
        except SystemExit:
            print("  ! не загрузился, пропускаю")
    if not refs:
        print("Нет загруженных референсов."); sys.exit(1)

    inp = {
        "prompt": PROMPT,
        "resolution": RES,
        "aspect_ratio": ASPECT,
        "duration": DUR,
        "generate_audio": True,
        "reference_video_urls": refs[:3],
    }
    print("Создаю задачу Seedance 2 (v2v)...")
    resp = k._req("POST", k.BASE + "/createTask", {"model": "bytedance/seedance-2", "input": inp})
    task_id = (resp.get("data") or {}).get("taskId")
    if not task_id:
        print("Нет taskId:", resp); sys.exit(1)
    print("taskId:", task_id)

    url = k.poll(task_id)
    if not url:
        print("Готово, но URL не найден."); sys.exit(1)
    print("Видео:", url)
    path = k.download(url, task_id)

    # лог
    os.makedirs(k.OUT_DIR, exist_ok=True)
    new = not os.path.exists(k.LOG)
    with open(k.LOG, "a", encoding="utf-8") as f:
        if new:
            f.write("# Лог генераций KIE\n\n| дата | модель | режим | res | сек | ~cr | ~$ | файл | промт |\n|---|---|---|---|---|---|---|---|---|\n")
        dt = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
        f.write(f"| {dt} | seedance-2 | v2v | {RES} | {DUR} | {cr:.0f} | {usd:.2f} | {os.path.basename(path)} | AVSound промо |\n")

    print("Сохранено:", path)
    b = k.balance(); print(f"Остаток: {b} cr (~${b*k.USD_PER_CREDIT:.2f})")


if __name__ == "__main__":
    main()
