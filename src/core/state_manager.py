"""
state_manager — статус обработки каждой строки Excel + resume после обрыва.

row_key = хэш(норм.название + бренд + категория) (docs/STATE_AND_RECOVERY.md).
Статусы: pending | done | failed | skipped | needs_manual_review.
Запись атомарная, после каждого товара. Ничего не пишет в WooCommerce.
"""
from __future__ import annotations

import hashlib
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from core.logger import get_logger  # noqa: E402

log = get_logger("state_manager")

PROJECT_ROOT = Path(__file__).resolve().parents[2]
STATE_DIR = PROJECT_ROOT / "state"
PROGRESS_FILE = STATE_DIR / "progress.json"

VALID = {"pending", "done", "failed", "skipped", "needs_manual_review"}


def make_row_key(name_norm: str, brand: str, category: str | None) -> str:
    raw = f"{name_norm}|{brand}|{category or ''}".lower()
    return hashlib.md5(raw.encode("utf-8")).hexdigest()[:16]


class StateManager:
    def __init__(self, path: Path = PROGRESS_FILE) -> None:
        self.path = path
        self.data: dict[str, dict] = {}
        if path.exists():
            try:
                self.data = json.loads(path.read_text(encoding="utf-8"))
            except Exception:
                log.warning("progress.json повреждён, начинаю с пустого")

    def status(self, row_key: str) -> str | None:
        rec = self.data.get(row_key)
        return rec.get("status") if rec else None

    def is_done(self, row_key: str) -> bool:
        return self.status(row_key) == "done"

    def set(self, row_key: str, status: str, **extra) -> None:
        assert status in VALID, f"неизвестный статус {status}"
        rec = self.data.get(row_key, {})
        rec.update({"status": status, **extra})
        self.data[row_key] = rec
        self._flush()

    def _flush(self) -> None:
        STATE_DIR.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps(self.data, ensure_ascii=False, indent=1), encoding="utf-8")
        os.replace(tmp, self.path)  # атомарно

    def summary(self) -> dict[str, int]:
        out: dict[str, int] = {}
        for rec in self.data.values():
            s = rec.get("status", "pending")
            out[s] = out.get(s, 0) + 1
        return out


if __name__ == "__main__":
    sm = StateManager(STATE_DIR / "progress_selftest.json")
    k = make_row_key("uno plus", "Pride", "Усилители")
    sm.set(k, "done", product_id=41560, row=7)
    print("row_key:", k, "| status:", sm.status(k), "| resume пропустит done:", sm.is_done(k))
    print("summary:", sm.summary())
