"""
logger — единое логирование проекта.

Каждый модуль получает свой именованный логгер; всё пишется и в консоль,
и в файл logs/run_<дата>.log. Секреты логировать нельзя (см. CODING_STANDARDS).
Без сторонних зависимостей — стандартный logging.
"""
from __future__ import annotations

import logging
from datetime import datetime
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
LOGS_DIR = PROJECT_ROOT / "logs"

_LOG_FORMAT = "%(asctime)s | %(levelname)-7s | %(name)s | %(message)s"
_configured = False


def _setup_root() -> None:
    """Один раз настроить корневой логгер: консоль + файл на текущий день."""
    global _configured
    if _configured:
        return
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    logfile = LOGS_DIR / f"run_{datetime.now():%Y-%m-%d}.log"

    root = logging.getLogger("avsound")
    root.setLevel(logging.INFO)
    root.propagate = False

    fmt = logging.Formatter(_LOG_FORMAT)

    console = logging.StreamHandler()
    console.setFormatter(fmt)
    root.addHandler(console)

    file_handler = logging.FileHandler(logfile, encoding="utf-8")
    file_handler.setFormatter(fmt)
    root.addHandler(file_handler)

    _configured = True


def get_logger(name: str) -> logging.Logger:
    """Логгер модуля, напр. get_logger('excel_reader')."""
    _setup_root()
    return logging.getLogger(f"avsound.{name}")


if __name__ == "__main__":
    log = get_logger("selftest")
    log.info("Логгер запущен.")
    log.warning("Это предупреждение (пример).")
    log.error("Это ошибка (пример).")
    print(f"Лог-файл: {LOGS_DIR / ('run_' + datetime.now().strftime('%Y-%m-%d') + '.log')}")
