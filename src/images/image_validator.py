"""
image_validator — rule-based отсев плохих кандидатов (без vision-модели).

Правила (docs/IMAGE_RULES.md):
- маркетплейсы/агрегаторы с чужими ватермарками на товаре → reject;
- ценник/баннер/реклама в title → reject;
- слишком маленькое → reject (низкое качество);
- бренд не найден в title/url/домене → reject (вероятно другой товар);
- водяной знак только на фоне/в углу (известные магазины) → accept с пометкой (KIE заменит фон);
- дубли по image_url → убрать.
Vision-проверка (логотип/ватермарк НА товаре) — отдельный шаг в будущем.
"""
from __future__ import annotations

import sys
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from core.logger import get_logger  # noqa: E402

log = get_logger("image_validator")

MIN_SIDE = 500

# Маркетплейсы — часто чужой ватермарк НА товаре / чужой товар. Отклоняем.
REJECT_DOMAINS = ["avito", "aliexpress", "ozon", "wildberries", "market.yandex",
                  "drom.ru", "youla", "ebay", "amazon"]
# Магазины, где ватермарк обычно на ФОНЕ/в углу — допустимо (KIE заменит фон).
BG_WATERMARK_OK = ["loudsound.ru", "shop-bear.ru", "sundownaudio.ru"]
# Запрещённые слова в title (ценник/реклама/баннер).
BAD_WORDS = ["цена", "купить за", "акци", "скидк", "распродаж", "sale", "баннер",
             "реклам", "промокод", "купон", "обзор", "отзыв", "youtube", "видео"]


@dataclass
class Verdict:
    accepted: bool
    reason: str
    note: str = ""


def validate(cand, brand: str, model: str) -> Verdict:
    """Проверить одного кандидата. cand — image_search.Candidate."""
    dom = (cand.source_domain or "").lower()
    title = (cand.title or "").lower()
    url = (cand.image_url or "").lower()
    blob = f"{title} {url} {dom}"

    if any(d in dom for d in REJECT_DOMAINS):
        return Verdict(False, f"marketplace_domain:{dom}")

    if any(w in title for w in BAD_WORDS):
        return Verdict(False, "bad_title_word")

    w, h = cand.width or 0, cand.height or 0
    if w and h and (w < MIN_SIDE or h < MIN_SIDE):
        return Verdict(False, f"too_small:{w}x{h}")

    # бренд должен присутствовать (иначе вероятно другой товар)
    bwords = [b for b in brand.lower().split() if len(b) > 1]
    if bwords and not any(b in blob for b in bwords):
        return Verdict(False, "brand_not_in_title_url")

    note = ""
    if any(d in dom for d in BG_WATERMARK_OK):
        note = "watermark_background_ok (KIE заменит фон)"

    return Verdict(True, "ok", note)


def filter_candidates(cands: list, brand: str, model: str):
    """Вернуть (accepted, rejected) с дедупом по image_url."""
    seen = set()
    accepted, rejected = [], []
    for c in cands:
        if c.image_url in seen:
            rejected.append((c, Verdict(False, "duplicate")))
            continue
        seen.add(c.image_url)
        v = validate(c, brand, model)
        (accepted if v.accepted else rejected).append((c, v))
    return accepted, rejected


if __name__ == "__main__":
    from images.image_search import search_images
    cands = search_images("Pride", "Uno plus", 10)
    acc, rej = filter_candidates(cands, "Pride", "Uno plus")
    log.info("найдено=%d принято=%d отклонено=%d", len(cands), len(acc), len(rej))
    for c, v in acc[:3]:
        log.info("  OK %s | %s", c.source_domain, v.note)
    for c, v in rej[:3]:
        log.info("  -- %s | %s", c.source_domain, v.reason)
