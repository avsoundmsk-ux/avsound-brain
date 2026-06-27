"""
normalizer — нормализация товара: канон бренда, нормализация названия,
извлечение модели и различающих токенов (D2/D4, 10"/12", ver.2, тип, active…).

Цель — НЕ потерять отличия вариантов (D2 != D4, 10" != 12"), чтобы матчинг
не склеил разные товары (docs/MATCHING_RULES.md, GLOSSARY.md).

Не подключается к WooCommerce, ничего не пишет на сайт.
Запуск: python src/products/normalizer.py
"""
from __future__ import annotations

import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from core.logger import get_logger  # noqa: E402

log = get_logger("normalizer")

# --- Канонизация брендов (расширяется без правки кода — в будущем config/brands.yml) ---
BRAND_CANON = {
    "quart": "MB Quart",
    "mb quart": "MB Quart",
    "mbquart": "MB Quart",
    "jbl": "JBL",
    "nakamichi": "Nakamichi",
    "ural": "Ural",
    "урал": "Ural",
}

# Слова-типы (убираются при выделении модели; они НЕ часть модели).
TYPE_WORDS = [
    "компонентная", "коаксиальная", "акустическая", "акустика", "система",
    "среднечастотная", "среднечастотные", "широкополосная", "сабвуфер",
    "сабвуферный", "динамик", "динамики", "твитер", "твитера", "твитеры",
    "пищалка", "пищалки", "рупор", "рупора", "мидбас", "мидбасы", "мидрейндж",
    "усилитель", "моноблок", "процессорный", "магнитола", "преобразователь",
    "активный", "пассивный", "комплект", "автомобильный", "автомобильная",
    "корпусной", "штатная",
]

# Тип товара по ключевым словам (рус + eng).
TYPE_KEYWORDS = {
    "component": ["компонент", "component", "components"],
    "coaxial": ["коаксиал", "coaxial", "coax"],
    "tweeter": ["твитер", "tweeter", "пищалк", "рупор", "horn"],
    "midbass": ["мидбас", "midbass", "mid-bass"],
    "subwoofer": ["сабвуфер", "subwoofer", "sub "],
    "amplifier": ["усилитель", "моноблок", "amplifier", "monoblock"],
    "headunit": ["магнитола", "headunit", "android"],
}


@dataclass
class Normalized:
    name_raw: str
    brand_excel: str
    brand_canon: str
    name_norm: str
    model: str
    tokens: dict = field(default_factory=dict)
    status: str = "ok"
    reason: str = ""


def canon_brand(raw: str) -> str:
    """Привести бренд к каноническому имени; иначе вернуть как есть (с заглавной)."""
    key = re.sub(r"\s+", " ", str(raw).strip().lower())
    return BRAND_CANON.get(key, str(raw).strip())


def normalize_name(name: str) -> str:
    """Полная нормализация для сравнения (одинаково для Excel и сайта)."""
    s = str(name).lower().replace("ё", "е")
    # версии к единому виду v2/v3
    s = re.sub(r"\b(?:ver\.?|version|вер\.?|v\.?|mk|мк)\s?(\d)\b", r" v\1", s)
    s = re.sub(r"\bmkii\b", " v2", s)
    s = re.sub(r"\bmkiii\b", " v3", s)
    # единицы
    s = s.replace(",", ".")            # 6,5 -> 6.5
    s = re.sub(r"(\d)\s?см\b", r"\1cm", s)
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"[^\w.\"'/\- ]", " ", s)  # убрать прочую пунктуацию, оставить . " ' / -
    s = re.sub(r"\s+", " ", s).strip()
    return s


def extract_model(name_norm: str, brand_canon: str) -> str:
    """Модель = нормализованное имя минус бренд и слова-типы."""
    s = name_norm
    # убрать бренд (любой вариант написания); длинные варианты первыми ("mb quart" до "quart")
    variants = {brand_canon.lower(), *[k for k, v in BRAND_CANON.items() if v == brand_canon]}
    for variant in sorted(variants, key=len, reverse=True):
        s = re.sub(rf"\b{re.escape(variant)}\b", " ", s)
    for w in TYPE_WORDS:
        s = re.sub(rf"\b{re.escape(w)}\b", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def extract_tokens(name_norm: str) -> dict:
    """Различающие признаки варианта — их нельзя терять."""
    t: dict = {}
    # импеданс D1/D2/D4
    imp = re.findall(r"\bd([1-9])\b", name_norm)
    if imp:
        t["impedance"] = sorted({f"D{x}" for x in imp})
    # размер в дюймах: 10" / 12"
    inch = re.findall(r"\b(\d{1,2})\"", name_norm)
    # размер без кавычек среди типовых диаметров
    bare = re.findall(r"\b(8|10|12|13|15|16|18)\b", name_norm)
    sizes = sorted({*(f'{x}"' for x in inch), *bare})
    if sizes:
        t["size"] = sizes
    # версия
    ver = re.findall(r"\bv(\d)\b", name_norm)
    if ver:
        t["version"] = sorted({f"v{x}" for x in ver})
    # active / passive
    if re.search(r"\bактив|active\b", name_norm):
        t["power"] = "active"
    elif re.search(r"\bпассив|passive\b", name_norm):
        t["power"] = "passive"
    # тип
    types = [k for k, kws in TYPE_KEYWORDS.items() if any(kw in name_norm for kw in kws)]
    if types:
        t["type"] = types
    return t


def analyze(name_raw: str, brand_excel: str, price=None, qty=None) -> Normalized:
    """Полный разбор одной позиции + статус по качеству данных."""
    bc = canon_brand(brand_excel)
    nn = normalize_name(name_raw)
    n = Normalized(
        name_raw=name_raw,
        brand_excel=brand_excel,
        brand_canon=bc,
        name_norm=nn,
        model=extract_model(nn, bc),
        tokens=extract_tokens(nn),
    )
    # проблемное количество/цена → ручная проверка (строку НЕ удаляем)
    if price in (None, "") or qty in (None, ""):
        n.status = "needs_manual_review"
        n.reason = "invalid_quantity_or_price"
    return n


def _demo() -> int:
    """Dry-run: прогнать реальные строки Excel через нормализатор."""
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from excel.excel_reader import read_excel

    xlsx = Path(__file__).resolve().parents[2] / "input" / "(8).xlsx"
    res = read_excel(xlsx)
    if not res.products:
        log.error("Нет товаров (проверь %s). Проблемы: %s", xlsx, res.problems[:3])
        return 1

    # выбрать примеры: первые + те, где есть токены/проблемы
    sample = res.products[:8]
    extras = [p for p in res.products if p.qty is None][:4]
    rich = [p for p in res.products if re.search(r'd[1-9]|\d"|ver|\bv\d', normalize_name(p.name))][:6]
    seen, picked = set(), []
    for p in sample + rich + extras:
        if p.row not in seen:
            seen.add(p.row); picked.append(p)

    log.info("=== NORMALIZER DRY-RUN (%d примеров) ===", len(picked))
    for p in picked:
        n = analyze(p.name, p.brand, p.price, p.qty)
        log.info("-" * 70)
        log.info("исходное : %s", n.name_raw)
        log.info("бренд    : %s -> %s", n.brand_excel, n.brand_canon)
        log.info("norm     : %s", n.name_norm)
        log.info("модель   : %s", n.model)
        log.info("токены   : %s", n.tokens or "-")
        log.info("статус   : %s%s", n.status, f" ({n.reason})" if n.reason else "")
    return 0


if __name__ == "__main__":
    raise SystemExit(_demo())
