"""
audit_manager — журнал изменений (docs/AUDIT_RULES.md).

Сейчас НИЧЕГО не пишет в WooCommerce. Готовит структуру аудита:
run_id, привязку Excel-строка → product_id, заготовку «было/стало».
В будущем — основа Rollback.

Структура: /audit/<run_id>/ → audit.json, changes.json, images.json,
errors.json, summary.json (+ csv/xlsx добавим при реальном write-этапе).
"""
from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from core.logger import get_logger  # noqa: E402

log = get_logger("audit_manager")

PROJECT_ROOT = Path(__file__).resolve().parents[2]
AUDIT_ROOT = PROJECT_ROOT / "audit"
PROGRAM_VERSION = "0.1.0"
DOCS_VERSION = "spec-2026-06"
USER = "AI Agent"


class AuditManager:
    def __init__(self, mode: str = "dry-run", excel_file: str = "") -> None:
        self.run_id = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        self.mode = mode
        self.excel_file = excel_file
        self.dir = AUDIT_ROOT / self.run_id
        self.changes: list[dict] = []
        self.images: list[dict] = []
        self.errors: list[dict] = []

    def _meta(self, **kw) -> dict:
        return {
            "datetime": datetime.now().isoformat(timespec="seconds"),
            "run_id": self.run_id,
            "program_version": PROGRAM_VERSION,
            "docs_version": DOCS_VERSION,
            "user": USER,
            "mode": self.mode,
            "excel_file": self.excel_file,
            **kw,
        }

    def record_change(self, *, excel_row: int, product_id, sku, name, brand,
                      action: str, reason: str, fields: dict | None = None) -> None:
        """fields = {поле: {'old': ..., 'new': ...}}. Пока заготовка (без записи на сайт)."""
        self.changes.append(self._meta(
            excel_row=excel_row, product_id=product_id, sku=sku, name=name,
            brand=brand, action=action, reason=reason, fields=fields or {},
        ))

    def record_images(self, *, product_id, old_urls, new_urls,
                      old_attachment_ids=None, new_attachment_ids=None,
                      source="", kie_attempts=0, cost_usd=0.0, status="planned") -> None:
        self.images.append(self._meta(
            product_id=product_id, old_urls=old_urls, new_urls=new_urls,
            old_attachment_ids=old_attachment_ids or [], new_attachment_ids=new_attachment_ids or [],
            source=source, kie_attempts=kie_attempts, cost_usd=cost_usd, status=status,
        ))

    def record_error(self, *, stage, module, message, recommendation="") -> None:
        self.errors.append(self._meta(stage=stage, module=module,
                                      message=message, recommendation=recommendation))

    def flush(self, summary: dict | None = None) -> Path:
        self.dir.mkdir(parents=True, exist_ok=True)
        (self.dir / "changes.json").write_text(json.dumps(self.changes, ensure_ascii=False, indent=1), encoding="utf-8")
        (self.dir / "images.json").write_text(json.dumps(self.images, ensure_ascii=False, indent=1), encoding="utf-8")
        (self.dir / "errors.json").write_text(json.dumps(self.errors, ensure_ascii=False, indent=1), encoding="utf-8")
        (self.dir / "summary.json").write_text(json.dumps(
            self._meta(summary=summary or {}, changes=len(self.changes),
                       images=len(self.images), errors=len(self.errors)),
            ensure_ascii=False, indent=1), encoding="utf-8")
        (self.dir / "audit.json").write_text(json.dumps(
            {"meta": self._meta(), "changes": self.changes, "images": self.images, "errors": self.errors},
            ensure_ascii=False, indent=1), encoding="utf-8")
        log.info("Аудит сохранён: %s", self.dir)
        return self.dir


if __name__ == "__main__":
    am = AuditManager(mode="dry-run", excel_file="input/(8).xlsx")
    am.record_change(excel_row=7, product_id=41560, sku="PRIDE-…", name="Pride Uno plus",
                     brand="Pride", action="planned_update", reason="dry-run demo",
                     fields={"price": {"old": "10950", "new": "10950"}})
    p = am.flush(summary={"demo": True})
    print("run_id:", am.run_id, "| файлы в:", p)
