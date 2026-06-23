#!/usr/bin/env python3
"""
kie_gen.py — генерация видео через KIE.ai (Seedance 2 и др.) без сторонних зависимостей.

Воркфлоу AVSound: дешёвые ролики для автозвука вместо Higgsfield.
- t2v (text-to-video): только промт.
- i2v (image-to-video): --image URL → вдвое дешевле за секунду + меньше брака.

Примеры:
  python tools/kie_gen.py "сабвуфер Pride в багажнике, пульсация, кинематографично" --res 720p --dur 5
  python tools/kie_gen.py "оживи кадр" --image https://.../frame.png --res 720p --dur 8 --fast

Ключ берётся из env KIE_API_KEY или из памяти api-keys.md (захардкожен ниже как fallback).
"""
import argparse, json, os, sys, time, urllib.request, urllib.error, datetime, re

API_KEY = os.environ.get("KIE_API_KEY", "215658af0b544ff57ac5645c36af2c9d")
BASE = "https://api.kie.ai/api/v1/jobs"
CREDIT_URL = "https://api.kie.ai/api/v1/chat/credit"
USD_PER_CREDIT = 0.005
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "media", "generated")
LOG = os.path.join(OUT_DIR, "_log.md")

# KIE кредиты/сек для Seedance 2 (std). i2v = "with video", t2v = "no video".
RATES = {
    ("480p", "i2v"): 11.5, ("480p", "t2v"): 19,
    ("720p", "i2v"): 25,   ("720p", "t2v"): 41,
    ("1080p", "i2v"): 62,  ("1080p", "t2v"): 102,
}


def _req(method, url, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", "Bearer " + API_KEY)
    req.add_header("Content-Type", "application/json")
    req.add_header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0 Safari/537.36")
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        print("HTTP", e.code, e.read().decode()[:500]); sys.exit(1)


def balance():
    return _req("GET", CREDIT_URL).get("data")


import base64, mimetypes

UPLOAD_URL = "https://kieai.redpandaai.co/api/file-base64-upload"


def upload_file(path, upload_path="avsound"):
    """Залить локальный файл в KIE → вернуть публичный URL (живёт 3 дня)."""
    mime = mimetypes.guess_type(path)[0] or "application/octet-stream"
    with open(path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode()
    payload = {
        "base64Data": f"data:{mime};base64,{b64}",
        "uploadPath": upload_path,
        "fileName": os.path.basename(path),
    }
    r = _req("POST", UPLOAD_URL, payload)
    url = (r.get("data") or {}).get("downloadUrl")
    if not url:
        print("Аплоад не вернул URL:", r); sys.exit(1)
    return url


def estimate(res, mode, dur):
    rate = RATES.get((res, mode))
    if not rate:
        return None, None
    cr = rate * dur
    return cr, cr * USD_PER_CREDIT


def create(args):
    if args.image and os.path.exists(args.image):
        print("Заливаю фото:", os.path.basename(args.image))
        args.image = upload_file(args.image, "avsound/img")
        print("  ->", args.image)
    mode = "i2v" if args.image else "t2v"
    inp = {
        "prompt": args.prompt,
        "resolution": args.res,
        "aspect_ratio": args.aspect,
        "duration": args.dur,
        "generate_audio": args.audio,
    }
    if args.image:
        inp["first_frame_url"] = args.image
    model = "bytedance/seedance-2-fast" if args.fast else "bytedance/seedance-2"
    cr, usd = estimate(args.res, mode, args.dur)
    bal = balance()
    print(f"Модель: {model} | режим: {mode} | {args.res} {args.dur}с")
    if cr:
        print(f"Оценка: ~{cr:.0f} cr (~${usd:.2f}). Баланс: {bal} cr (~${bal*USD_PER_CREDIT:.2f})")
        if cr > bal:
            print("! Не хватает кредитов. Понизь res/dur или пополни."); sys.exit(1)
    resp = _req("POST", BASE + "/createTask", {"model": model, "input": inp})
    task_id = resp.get("data", {}).get("taskId")
    if not task_id:
        print("Нет taskId:", resp); sys.exit(1)
    print("taskId:", task_id)
    return task_id, model, mode, cr, usd


def poll(task_id):
    url = BASE + "/recordInfo?taskId=" + task_id
    for _ in range(120):  # до ~10 мин
        d = _req("GET", url).get("data", {})
        state = str(d.get("state", "")).lower()
        if state in ("success", "completed", "succeed"):
            return _extract_url(d)
        if state in ("fail", "failed", "error"):
            print("Генерация упала:", json.dumps(d)[:500]); sys.exit(1)
        print("  ...", state or "wait")
        time.sleep(5)
    print("Таймаут ожидания."); sys.exit(1)


def _extract_url(d):
    rj = d.get("resultJson")
    if isinstance(rj, str):
        try:
            d2 = json.loads(rj)
            urls = d2.get("resultUrls") or d2.get("urls")
            if urls:
                return urls[0]
        except Exception:
            pass
    m = re.search(r"https?://[^\s\"']+\.mp4", json.dumps(d))
    return m.group(0) if m else None


def download(url, task_id):
    os.makedirs(OUT_DIR, exist_ok=True)
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    path = os.path.join(OUT_DIR, f"{ts}_{task_id[-8:]}.mp4")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0 Safari/537.36"})
    with urllib.request.urlopen(req, timeout=120) as r, open(path, "wb") as f:
        f.write(r.read())
    return os.path.abspath(path)


def log(model, mode, args, cr, usd, path):
    os.makedirs(OUT_DIR, exist_ok=True)
    new = not os.path.exists(LOG)
    with open(LOG, "a", encoding="utf-8") as f:
        if new:
            f.write("# Лог генераций KIE\n\n| дата | модель | режим | res | сек | ~cr | ~$ | файл | промт |\n|---|---|---|---|---|---|---|---|---|\n")
        dt = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
        cr_s = f"{cr:.0f}" if cr else "?"
        usd_s = f"{usd:.2f}" if usd else "?"
        f.write(f"| {dt} | {model} | {mode} | {args.res} | {args.dur} | {cr_s} | {usd_s} | {os.path.basename(path)} | {args.prompt[:60]} |\n")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("prompt")
    p.add_argument("--image", help="URL стартового кадра → режим i2v (дешевле)")
    p.add_argument("--res", default="720p", choices=["480p", "720p", "1080p"])
    p.add_argument("--dur", type=int, default=5)
    p.add_argument("--aspect", default="16:9")
    p.add_argument("--audio", action="store_true", help="генерить звук")
    p.add_argument("--fast", action="store_true", help="seedance-2-fast (дешевле, до 720p)")
    p.add_argument("--balance", action="store_true", help="только показать баланс")
    args = p.parse_args()

    if args.balance:
        b = balance(); print(f"Баланс: {b} cr (~${b*USD_PER_CREDIT:.2f})"); return

    task_id, model, mode, cr, usd = create(args)
    url = poll(task_id)
    if not url:
        print("Готово, но URL не найден."); sys.exit(1)
    print("Видео:", url)
    path = download(url, task_id)
    log(model, mode, args, cr, usd, path)
    print("Сохранено:", path)
    b = balance(); print(f"Остаток: {b} cr (~${b*USD_PER_CREDIT:.2f})")


if __name__ == "__main__":
    main()
