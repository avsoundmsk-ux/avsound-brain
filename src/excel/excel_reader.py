"""
excel_reader — чтение входного Excel (только чтение, файл не меняется).

Формат описан в docs/EXCEL_FORMAT.md:
  A Статус | B состояние | C GoodsType | D категория | E название |
  F стоимость | G количество | H закуп | I пометка
Блоки по брендам: строка-секция = один непустой текст (бренд), далее товары.

Модуль НЕ подключается к WooCommerce и не выполняет Live Run.
Запуск: python src/excel/excel_reader.py input/(8).xlsx
"""
from __future__ import annotations

import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

import openpyxl

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from core.logger import get_logger  # noqa: E402

log = get_logger("excel_reader")

# Индексы колонок A..I (0-based).
COL_STATUS, COL_CONDITION, COL_GOODSTYPE, COL_CATEGORY = 0, 1, 2, 3
COL_NAME, COL_PRICE, COL_QTY, COL_COST, COL_NOTE = 4, 5, 6, 7, 8

HEADER_MARKER = "GoodsType"  # по этой ячейке узнаём строку-заголовок


@dataclass
class Product:
    row: int           # номер строки Excel (1-based)
    brand: str         # бренд из секции/названия
    name: str          # исходное название (колонка E)
    name_norm: str     # нормализованное название
    category: str | None
    price: str | None
    qty: int | None
    cost: str | None   # закуп — только локально, не публикуется


@dataclass
class ReadResult:
    products: list[Product] = field(default_factory=list)
    brands: list[str] = field(default_factory=list)
    categories: dict[str, int] = field(default_factory=dict)
    total_rows: int = 0
    skipped_empty: int = 0
    skipped_section: int = 0
    problems: list[str] = field(default_factory=list)


def normalize_name(name: str) -> str:
    """Лёгкая нормализация имени: пробелы, регистр единиц. Полная norm — в products/normalizer."""
    s = str(name).strip()
    s = re.sub(r"\s+", " ", s)
    s = s.replace("ё", "е")
    return s


def _clean(value) -> str | None:
    if value is None:
        return None
    s = str(value).strip()
    return s or None


def _to_int(value) -> int | None:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def _is_section_row(cells: list) -> str | None:
    """Строка-секция = ровно один непустой текст и пустое название (колонка E)."""
    nonempty = [c for c in cells if _clean(c) is not None]
    if len(nonempty) == 1 and _clean(cells[COL_NAME]) is None and isinstance(nonempty[0], str):
        return _clean(nonempty[0])
    return None


def read_excel(path: str | Path) -> ReadResult:
    """Прочитать Excel и вернуть распознанные товары + dry-run статистику."""
    path = Path(path)
    res = ReadResult()
    if not path.exists():
        res.problems.append(f"Файл не найден: {path}")
        return res

    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb.active
    current_brand: str | None = None
    header_seen = False

    for i, row in enumerate(ws.iter_rows(values_only=True), start=1):
        res.total_rows += 1
        cells = list(row) + [None] * (9 - len(row)) if len(row) < 9 else list(row)

        # Заголовок таблицы.
        if not header_seen and any(_clean(c) == HEADER_MARKER for c in cells):
            header_seen = True
            res.skipped_section += 1
            continue

        # Полностью пустая строка.
        if all(_clean(c) is None for c in cells):
            res.skipped_empty += 1
            continue

        # Строка-секция (бренд).
        section = _is_section_row(cells)
        if section is not None:
            current_brand = section
            if section not in res.brands:
                res.brands.append(section)
            res.skipped_section += 1
            continue

        # Строка товара.
        name = _clean(cells[COL_NAME])
        if name is None:
            res.skipped_empty += 1
            continue

        brand = current_brand or name.split()[0]
        if current_brand is None:
            res.problems.append(f"Строка {i}: бренд не определён по секции, взят из названия ('{brand}')")

        category = _clean(cells[COL_CATEGORY])
        if category:
            res.categories[category] = res.categories.get(category, 0) + 1

        price = _clean(cells[COL_PRICE])
        if price is None:
            res.problems.append(f"Строка {i}: нет цены ('{name}') → ручная проверка")
        if _to_int(cells[COL_QTY]) is None:
            res.problems.append(f"Строка {i}: нет/некорректное количество ('{name}')")

        res.products.append(Product(
            row=i,
            brand=brand,
            name=name,
            name_norm=normalize_name(name),
            category=category,
            price=price,
            qty=_to_int(cells[COL_QTY]),
            cost=_clean(cells[COL_COST]),
        ))

    wb.close()
    return res


def print_report(res: ReadResult) -> None:
    """Dry-run отчёт в консоль/лог."""
    log.info("=== EXCEL DRY-RUN ОТЧЁТ ===")
    log.info("Всего строк: %d", res.total_rows)
    log.info("Товаров распознано: %d", len(res.products))
    log.info("Пропущено пустых: %d | служебных/секций: %d", res.skipped_empty, res.skipped_section)
    log.info("Бренды (%d): %s", len(res.brands), ", ".join(res.brands))
    log.info("Категории из Excel (%d):", len(res.categories))
    for cat, n in sorted(res.categories.items(), key=lambda x: -x[1]):
        log.info("   %-30s %d", cat, n)
    log.info("Первые 10 товаров:")
    for p in res.products[:10]:
        log.info("   [%s] %s | бренд=%s | кат=%s | цена=%s | кол=%s",
                 p.row, p.name, p.brand, p.category, p.price, p.qty)
    if res.problems:
        log.info("Проблемы (%d, первые 15):", len(res.problems))
        for prob in res.problems[:15]:
            log.info("   ! %s", prob)


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print("Использование: python src/excel/excel_reader.py <путь.xlsx>")
        return 1
    res = read_excel(argv[1])
    print_report(res)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
