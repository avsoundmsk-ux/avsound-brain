"""
report_generator — отчёт по результатам product_matcher/category_resolver.

Экспорт csv / xlsx / json в output/run_<date>/ (docs/REPORT_FORMAT.md).
Только чтение результатов, ничего не пишет в WooCommerce.
"""
from __future__ import annotations

import csv
import json
import sys
from dataclasses import asdict, is_dataclass
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from core.logger import get_logger  # noqa: E402

log = get_logger("report_generator")

PROJECT_ROOT = Path(__file__).resolve().parents[2]
OUTPUT_ROOT = PROJECT_ROOT / "output"

COLUMNS = ["row", "name", "brand", "product_id", "score", "status", "reason",
           "category_id", "category_status"]


def _to_dict(r) -> dict:
    return asdict(r) if is_dataclass(r) else dict(r)


def generate(results: list, mode: str = "dry-run") -> Path:
    """Сохранить отчёт в output/run_<date>/ в csv/xlsx/json. Вернуть папку."""
    run_dir = OUTPUT_ROOT / f"run_{datetime.now():%Y-%m-%d_%H-%M-%S}"
    run_dir.mkdir(parents=True, exist_ok=True)
    rows = [_to_dict(r) for r in results]

    # сводка
    summary: dict[str, int] = {}
    for r in rows:
        summary[r["status"]] = summary.get(r["status"], 0) + 1
    problems = sum(1 for r in rows if r["status"] != "matched")

    # JSON
    (run_dir / "report.json").write_text(
        json.dumps({"mode": mode, "generated": datetime.now().isoformat(timespec="seconds"),
                    "total": len(rows), "summary": summary, "problems": problems, "rows": rows},
                   ensure_ascii=False, indent=1), encoding="utf-8")

    # CSV
    with open(run_dir / "report.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS)
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k) for k in COLUMNS})

    # XLSX (openpyxl)
    try:
        import openpyxl
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "report"
        ws.append(COLUMNS)
        for r in rows:
            ws.append([r.get(k) for k in COLUMNS])
        wb.save(run_dir / "report.xlsx")
    except Exception as e:
        log.warning("xlsx не создан: %s", type(e).__name__)

    (run_dir / "summary.json").write_text(
        json.dumps({"total": len(rows), "summary": summary, "problems": problems},
                   ensure_ascii=False, indent=1), encoding="utf-8")

    log.info("Отчёт сохранён: %s (csv/xlsx/json)", run_dir)
    log.info("Итог: всего=%d | %s | проблемных=%d", len(rows), summary, problems)
    return run_dir


if __name__ == "__main__":
    # мини-демо без сети
    demo = [{"row": 7, "name": "Pride Uno plus", "brand": "Pride", "product_id": 41560,
             "score": 95, "status": "matched", "reason": "score=95",
             "category_id": 256, "category_status": "ok"}]
    generate(demo)
