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


def _req(method, url, payload=None, _retries=5):
    """Запрос с авто-ретраями на сетевые сбои (нестабильный VPN). HTTP-ошибки не ретраим."""
    data = json.dumps(payload).encode() if payload is not None else None
    last = None
    for attempt in range(_retries):
        req = urllib.request.Request(url, data=data, method=method)
        req.add_header("Authorization", "Bearer " + API_KEY)
        req.add_header("Content-Type", "application/json")
        req.add_header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0 Safari/537.36")
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            print("HTTP", e.code, e.read().decode()[:500]); sys.exit(1)
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            last = e
            print(f"  сеть сбой ({attempt+1}/{_retries}): {str(e)[:80]} — ретрай через 5с")
            time.sleep(5)
    print("Сеть недоступна после ретраев:", str(last)[:200]); sys.exit(1)


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
    m = re.search(r"https?://[^\s\"']+\.(mp4|png|jpg|jpeg|webp|mp3|wav|gif)", json.dumps(d))
    return m.group(0) if m else None


def download(url, task_id):
    os.makedirs(OUT_DIR, exist_ok=True)
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    ext = re.search(r"\.(mp4|png|jpg|jpeg|webp|mp3|wav|gif)(?:\?|$)", url)
    ext = ext.group(1) if ext else "bin"
    path = os.path.join(OUT_DIR, f"{ts}_{task_id[-8:]}.{ext}")
    last = None
    for attempt in range(5):  # ретраи на сетевые сбои (VPN)
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0 Safari/537.36"})
            with urllib.request.urlopen(req, timeout=180) as r, open(path, "wb") as f:
                f.write(r.read())
            return os.path.abspath(path)
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            last = e
            print(f"  скачивание сбой ({attempt+1}/5): {str(e)[:80]} — ретрай через 5с")
            time.sleep(5)
    print("Не скачалось. URL (живёт 3 дня):", url)
    print("Ошибка:", str(last)[:200]); sys.exit(1)


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


# ---------- Универсальный генератор (любая модель KIE) ----------
# Подсказки: какие model_id считать видео-моделями (фото → first_frame_url/reference).
VIDEO_HINT = ("seedance", "kling", "veo", "wan", "video", "hailuo", "minimax",
              "runway", "sora", "pixverse", "luma", "vidu", "ltx")


def _to_url(x: str) -> str:
    """Локальный путь → загрузить в KIE и вернуть URL. Уже URL → как есть."""
    if os.path.exists(x):
        print("Заливаю:", os.path.basename(x))
        u = upload_file(x, "avsound/gen")
        print("  ->", u)
        return u
    return x


def _parse_set(items):
    """--set key=value → типизированный dict (int/float/bool/json/str)."""
    out = {}
    for it in items or []:
        k, _, v = it.partition("=")
        k, v = k.strip(), v.strip()
        if v[:1] in "[{":
            try:
                out[k] = json.loads(v); continue
            except Exception:
                pass
        if v.lower() in ("true", "false"):
            out[k] = (v.lower() == "true"); continue
        try:
            out[k] = int(v); continue
        except ValueError:
            pass
        try:
            out[k] = float(v); continue
        except ValueError:
            pass
        out[k] = v
    return out


def _log_generic(model, inp, spent, path):
    os.makedirs(OUT_DIR, exist_ok=True)
    new = not os.path.exists(LOG)
    with open(LOG, "a", encoding="utf-8") as f:
        if new:
            f.write("# Лог генераций KIE\n\n| дата | модель | cr | $ | файл | промт |\n|---|---|---|---|---|---|\n")
        dt = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
        cr = f"{spent:.0f}" if spent else "?"
        usd = f"{spent*USD_PER_CREDIT:.2f}" if spent else "?"
        pr = (inp.get("prompt") or "")[:60].replace("\n", " ")
        f.write(f"| {dt} | {model} | {cr} | {usd} | {os.path.basename(path)} | {pr} |\n")


def generate_cmd(args):
    images = [_to_url(x) for x in (args.image or [])]
    videos = [_to_url(x) for x in (args.video or [])]
    inp = {}
    if args.prompt:
        inp["prompt"] = args.prompt
    is_video = any(h in args.model.lower() for h in VIDEO_HINT) or bool(videos)
    if images:
        if is_video:
            if len(images) == 1:
                inp["first_frame_url"] = images[0]
            else:
                inp["reference_image_urls"] = images
        else:
            inp["image_urls"] = images
    if videos:
        inp["reference_video_urls"] = videos
    if args.audio:
        inp["generate_audio"] = True
    inp.update(_parse_set(args.set))  # passthrough/override любых полей

    bal_before = balance()
    print(f"Модель: {args.model}")
    print("input:", json.dumps(inp, ensure_ascii=False)[:400])
    print(f"Баланс до: {bal_before} cr (~${bal_before*USD_PER_CREDIT:.2f})")
    if args.dry:
        print("[dry-run] задача НЕ отправлена, списания нет.")
        return

    resp = _req("POST", BASE + "/createTask", {"model": args.model, "input": inp})
    task_id = (resp.get("data") or {}).get("taskId")
    if not task_id:
        print("Нет taskId:", resp); sys.exit(1)
    print("taskId:", task_id)
    url = poll(task_id)
    if not url:
        print("Готово, но URL результата не найден."); sys.exit(1)
    print("Результат:", url)
    path = download(url, task_id)
    bal_after = balance()
    spent = (bal_before - bal_after) if (bal_before is not None and bal_after is not None) else None
    _log_generic(args.model, inp, spent, path)
    print("Сохранено:", path)
    sp = f"{spent:.0f} cr (~${spent*USD_PER_CREDIT:.2f})" if spent else "?"
    print(f"Списано: {sp} | Остаток: {bal_after} cr (~${bal_after*USD_PER_CREDIT:.2f})")


def main():
    p = argparse.ArgumentParser(description="KIE.ai генератор — любая модель с сайта")
    sub = p.add_subparsers(dest="cmd")
    g = sub.add_parser("generate", help="сгенерить любой моделью KIE")
    g.add_argument("--model", required=True, help="model_id с KIE, напр. bytedance/seedance-2, google/nano-banana-edit")
    g.add_argument("--prompt", default="")
    g.add_argument("--image", action="append", help="локальный путь ИЛИ URL (можно несколько раз)")
    g.add_argument("--video", action="append", help="локальный путь ИЛИ URL видео-референса (можно несколько раз)")
    g.add_argument("--set", action="append", help="доп. параметр key=value (resolution=720p duration=8 aspect_ratio=9:16 ...)")
    g.add_argument("--audio", action="store_true", help="generate_audio=true")
    g.add_argument("--dry", action="store_true", help="сухой прогон: собрать payload + баланс, без списания")
    sub.add_parser("balance", help="показать баланс")
    args = p.parse_args()

    if args.cmd in (None, "balance"):
        b = balance(); print(f"Баланс: {b} cr (~${b*USD_PER_CREDIT:.2f})"); return
    if args.cmd == "generate":
        generate_cmd(args)


if __name__ == "__main__":
    main()
