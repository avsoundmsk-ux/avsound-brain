"""
category_resolver — сопоставление категории Excel → категория сайта (по CATEGORY_RULES.md).

Только определение id по утверждённой таблице. НИКОГДА не создаёт категории.
Нет однозначного соответствия / конфликт → статус manual (ручная проверка).

Не подключается к WooCommerce, ничего не пишет.
"""
from __future__ import annotations

from dataclasses import dataclass

# Верхний уровень: категория Excel (норм.) → id родителя (CATEGORY_RULES.md, утверждено).
TOP_LEVEL = {
    "усилители": 256,
    "сабвуфер": 294,
    "сабвуферы": 294,
    "магнитолы": 320,
    "автоакустика": 252,
    "аксессуары для автоакустики": 367,
    # "камеры" → отсутствует на сайте → manual
}

# Подкатегории: ключевое слово в нормализованном названии → id (только существующие на сайте).
SUBCATS = [
    # Акустика (родитель 252)
    (252, 295, ["компонент", "component"]),
    (252, 299, ["коаксиал", "coaxial", "coax"]),
    (252, 293, ["твитер", "tweeter", "пищалк", "рупор", "horn", " вч"]),
    (252, 303, ["мидбас", "midbass"]),
    (252, 306, ["среднечаст", "midrange", " сч"]),
    (252, 304, ["широкополос", "fullrange"]),
    (252, 301, ["драйвер", "driver"]),
    (252, 302, ["кроссовер", "crossover"]),
    # Сабвуферы (родитель 294)
    (294, 297, ["актив", "active"]),
    (294, 311, ["короб", "box", "корпус"]),
    (294, 310, ["сабвуфер", "subwoofer", " sub "]),
    # Усилители (родитель 256)
    (256, 314, ["процессорный усилитель", "dsp amplifier", "dsp усилитель"]),
    (256, 316, ["процессор", "processor", "dsp"]),
    (256, 318, ["преобразователь", "high-low", "конвертер"]),
    (256, 317, ["конденсатор", "capacitor"]),
    (256, 313, ["вольтметр", "voltmeter"]),
    (256, 312, ["усилитель", "моноблок", "amplifier", "monoblock"]),
    # Магнитолы (родитель 320)
    (320, 326, ["рамка", "fascia"]),
    (320, 325, ["iso", "изо"]),
    (320, 324, ["антенна", "gps"]),
    (320, 322, ["регистратор", "dvr"]),
    (320, 453, ["пульт", "remote", "drc"]),
    (320, 444, ["микрофон", "microphone"]),
    (320, 321, ["магнитола", "headunit", "android", "din"]),
]


@dataclass
class CategoryResult:
    parent_id: int | None
    sub_id: int | None
    final_id: int | None
    status: str          # ok | manual
    reason: str = ""


def resolve_category(excel_category: str | None, name_norm: str) -> CategoryResult:
    """Определить id категории по таблице соответствия + ключевым словам подкатегории."""
    if not excel_category:
        return CategoryResult(None, None, None, "manual", "no_category_in_excel")

    key = excel_category.strip().lower().replace("ё", "е")
    parent = TOP_LEVEL.get(key)
    if parent is None:
        return CategoryResult(None, None, None, "manual", f"category_not_mapped:{excel_category}")

    # подкатегории-кандидаты в рамках родителя
    matches = []
    for par, sub_id, words in SUBCATS:
        if par != parent:
            continue
        if any(w in name_norm for w in words):
            matches.append(sub_id)

    matches = list(dict.fromkeys(matches))  # уникальные, порядок сохранён
    # «усилитель/сабвуфер/магнитола» — слишком общий хвост; если кроме него есть точнее, берём точнее
    if parent == 256 and len(matches) > 1 and 312 in matches:
        matches = [m for m in matches if m != 312]
    if parent == 294 and len(matches) > 1 and 310 in matches:
        matches = [m for m in matches if m != 310]
    if parent == 320 and len(matches) > 1 and 321 in matches:
        matches = [m for m in matches if m != 321]

    if len(matches) == 1:
        return CategoryResult(parent, matches[0], matches[0], "ok")
    if len(matches) == 0:
        # подкатегория не определена → fallback на родителя верхнего уровня
        return CategoryResult(parent, None, parent, "ok", "parent_fallback")
    # несколько кандидатов → конфликт → ручная
    return CategoryResult(parent, None, None, "manual", f"subcategory_conflict:{matches}")


if __name__ == "__main__":
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from products.normalizer import normalize_name
    tests = [
        ("Автоакустика", "Компонентная акустическая система JBL GTO 608C"),
        ("Автоакустика", "Твитера Hertz HT 25"),
        ("Сабвуфер", "Активный сабвуфер Nakamichi"),
        ("Усилители", "Процессорный усилитель Hellion DSP"),
        ("Камеры", "Камера заднего вида"),
    ]
    for cat, nm in tests:
        r = resolve_category(cat, normalize_name(nm))
        print(f"{cat:20} | {nm[:40]:40} | id={r.final_id} | {r.status} {r.reason}")
