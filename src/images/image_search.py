"""
image_search — поиск изображений-кандидатов по бренду+модели (Brave Images API).

Только сбор кандидатов (метаданные). НИЧЕГО не скачивает массово, не грузит на сайт,
KIE не вызывает, деньги не тратит. Ключ Brave из config/.env.
Нет ключа → ошибка missing_brave_api_key.
"""
from __future__ import annotations

import sys
import time
from dataclasses import dataclass, asdict
from pathlib import Path
from urllib.parse import urlparse

import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from core.config_manager import config  # noqa: E402
from core.logger import get_logger  # noqa: E402

log = get_logger("image_search")

BRAVE_IMG_URL = "https://api.search.brave.com/res/v1/images/search"

# Приоритет источника по домену (1 = лучший).
MANUFACTURER = ["pride.audio", "jbl.com", "mbquart", "nakamichi", "ural-acoustic", "ural.ru"]
DEALER = ["loudsound.ru", "shop-bear.ru", "magnitola", "sundownaudio.ru"]


class MissingBraveApiKey(Exception):
    pass


@dataclass
class Candidate:
    image_url: str
    page_url: str
    title: str
    source_domain: str
    width: int | None
    height: int | None
    source_priority: int   # 1 произв., 2 дилер, 3 прочее


def _domain(url: str) -> str:
    try:
        return urlparse(url).netloc.lower().replace("www.", "")
    except Exception:
        return ""


def _priority(domain: str) -> int:
    if any(m in domain for m in MANUFACTURER):
        return 1
    if any(d in domain for d in DEALER):
        return 2
    return 3


def search_images(brand: str, model: str, count: int = 15) -> list[Candidate]:
    """Найти кандидатов по 'бренд модель'. Возвращает список Candidate (без скачивания)."""
    key = config.get("BRAVE_KEY")
    if not key:
        raise MissingBraveApiKey("missing_brave_api_key: задайте BRAVE_KEY в config/.env")

    query = f"{brand} {model}".strip()
    headers = {"X-Subscription-Token": key, "Accept": "application/json"}
    params = {"q": query, "count": count}
    last = None
    for attempt in range(3):
        try:
            r = requests.get(BRAVE_IMG_URL, params=params, headers=headers, timeout=25)
            if r.status_code == 200:
                break
            if r.status_code == 429:
                time.sleep(2); continue
            log.warning("Brave images %s для '%s'", r.status_code, query)
            return []
        except requests.exceptions.RequestException as e:
            last = e
            log.warning("сеть Brave, повтор %d/3: %s", attempt + 1, type(e).__name__)
            time.sleep(3)
    else:
        log.error("Brave недоступен: %s", type(last).__name__ if last else "?")
        return []

    out: list[Candidate] = []
    for it in r.json().get("results", []):
        props = it.get("properties", {}) or {}
        img = props.get("url") or it.get("thumbnail", {}).get("src")
        if not img:
            continue
        page = it.get("url", "")
        dom = _domain(page) or _domain(img)
        out.append(Candidate(
            image_url=img,
            page_url=page,
            title=it.get("title", "") or "",
            source_domain=dom,
            width=props.get("width") or it.get("thumbnail", {}).get("width"),
            height=props.get("height") or it.get("thumbnail", {}).get("height"),
            source_priority=_priority(dom),
        ))
    out.sort(key=lambda c: c.source_priority)
    return out


if __name__ == "__main__":
    try:
        cands = search_images("Pride", "Uno plus", count=10)
    except MissingBraveApiKey as e:
        print(e); raise SystemExit(1)
    log.info("Найдено кандидатов: %d", len(cands))
    for c in cands[:5]:
        log.info("  P%d | %s | %sx%s | %s", c.source_priority, c.source_domain,
                 c.width, c.height, c.image_url[:70])
