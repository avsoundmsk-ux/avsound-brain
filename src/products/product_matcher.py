"""
product_matcher — DRY-RUN сопоставление товаров Excel с товарами сайта.

Логика по docs/MATCHING_RULES.md:
  бренд обязателен; модель точно (+45) или fuzzy; категория; различающие токены;
  штраф за конфликт варианта. Решение: matched / not_found / needs_manual_review.

Только READ через WooReadClient. НИКАКИХ изменений сайта.
Запуск: python src/products/product_matcher.py "input/(8).xlsx" [--limit N]
"""
from __future__ import annotations

import sys
from dataclasses import dataclass
from difflib import SequenceMatcher
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from core.logger import get_logger  # noqa: E402
from excel.excel_reader import read_excel  # noqa: E402
from products.normalizer import analyze, canon_brand, extract_model, normalize_name  # noqa: E402
from products.category_resolver import resolve_category  # noqa: E402
from woocommerce.woocommerce_client import WooReadClient  # noqa: E402

log = get_logger("product_matcher")


@dataclass
class MatchResult:
    row: int
    name: str
    brand: str
    product_id: int | None
    score: int
    status: str          # matched | not_found | needs_manual_review
    reason: str
    category_id: int | None
    category_status: str


def _ratio(a: str, b: str) -> int:
    """token_sort ratio 0..100 без внешних зависимостей."""
    a2 = " ".join(sorted(a.split()))
    b2 = " ".join(sorted(b.split()))
    return round(SequenceMatcher(None, a2, b2).ratio() * 100)


def _site_brand(cand: dict) -> str:
    """Бренд кандидата с сайта: атрибут 'Производитель' или первое слово названия."""
    for a in cand.get("attributes", []):
        if str(a.get("name", "")).lower().startswith("производ"):
            opts = a.get("options") or []
            if opts:
                return canon_brand(opts[0])
    return canon_brand(cand.get("name", "").split()[0] if cand.get("name") else "")


def _tokens_conflict(t1: dict, t2: dict) -> bool:
    """Конфликт различающего токена (D2 vs D4, 10\" vs 12\", v2 vs v3)."""
    for key in ("impedance", "size", "version"):
        a, b = set(t1.get(key, [])), set(t2.get(key, []))
        if a and b and a.isdisjoint(b):
            return True
    return False


def score_candidate(exc, cand: dict) -> int:
    """Скоринг по MATCHING_RULES. Бренд обязателен — иначе 0."""
    site_brand = _site_brand(cand)
    if site_brand.lower() != exc.brand_canon.lower():
        return 0
    s = 35  # бренд совпал
    site_model = extract_model(normalize_name(cand.get("name", "")), site_brand)
    if site_model and site_model == exc.model:
        s += 45
    else:
        r = _ratio(exc.model, site_model)
        if r >= 92:
            s += 35
        elif r >= 85:
            s += 20
    # различающие токены
    from products.normalizer import extract_tokens
    ct = extract_tokens(normalize_name(cand.get("name", "")))
    if _tokens_conflict(exc.tokens, ct):
        s -= 40
    elif exc.tokens and all(set(exc.tokens.get(k, [])) <= set(ct.get(k, []))
                            for k in ("impedance", "size", "version") if exc.tokens.get(k)):
        s += 10
    return s


def match_one(client: WooReadClient, prod) -> MatchResult:
    exc = analyze(prod.name, prod.brand, prod.price, prod.qty)
    cat = resolve_category(prod.category, exc.name_norm)

    # уже отсеяно на нормализации (битая цена/кол-во) → ручная, но матч всё равно покажем
    base_status = exc.status

    query = exc.model or exc.name_norm
    try:
        cands = client.search_products(query, per_page=10)
    except Exception as e:
        # сбой сети (VPN/timeout/SSL/connection) — это НЕ not_found
        return MatchResult(prod.row, prod.name, exc.brand_canon, None, 0,
                           "network_error", f"network:{type(e).__name__}",
                           cat.final_id, cat.status)

    scored = sorted(((score_candidate(exc, c), c) for c in cands), key=lambda x: -x[0])
    best_score = scored[0][0] if scored else 0
    best = scored[0][1] if scored else None
    ties = [c for sc, c in scored if best_score - sc < 10 and sc >= 75]

    if base_status == "needs_manual_review":
        status, reason = "needs_manual_review", exc.reason
        pid = best.get("id") if best and best_score >= 90 else None
    elif best_score >= 90 and len(ties) <= 1:
        status, reason, pid = "matched", f"score={best_score}", best.get("id")
    elif best_score >= 75:
        status, reason = "needs_manual_review", f"low_confidence_or_ties score={best_score} ties={len(ties)}"
        pid = None
    else:
        status, reason, pid = "not_found", f"best={best_score}", None

    return MatchResult(prod.row, prod.name, exc.brand_canon, pid, best_score,
                       status, reason, cat.final_id, cat.status)


def run(xlsx: str, limit: int | None = None) -> list[MatchResult]:
    res = read_excel(xlsx)
    products = res.products[:limit] if limit else res.products
    client = WooReadClient()
    out = []
    for i, p in enumerate(products, 1):
        out.append(match_one(client, p))
        if i % 20 == 0:
            log.info("...обработано %d/%d", i, len(products))
    return out


def report(results: list[MatchResult]) -> None:
    by = {"matched": 0, "not_found": 0, "needs_manual_review": 0}
    for r in results:
        by[r.status] = by.get(r.status, 0) + 1
    log.info("=== PRODUCT MATCHER DRY-RUN ===")
    log.info("Всего товаров: %d", len(results))
    log.info("matched: %d | not_found: %d | needs_manual_review: %d",
             by["matched"], by["not_found"], by["needs_manual_review"])
    log.info("Топ-20 примеров:")
    for r in results[:20]:
        log.info("  [%s] %-42s | бренд=%s | pid=%s | score=%s | %s | cat=%s/%s | %s",
                 r.row, r.name[:42], r.brand, r.product_id, r.score, r.status,
                 r.category_id, r.category_status, r.reason)
    log.info("Использован ТОЛЬКО READ (WooReadClient). Запись/создание/удаление не выполнялись.")


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print('Использование: python src/products/product_matcher.py "input/(8).xlsx" [--limit N]')
        return 1
    limit = None
    if "--limit" in argv:
        limit = int(argv[argv.index("--limit") + 1])
    report(run(argv[1], limit))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
