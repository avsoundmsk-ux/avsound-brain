"""
woocommerce_client — клиент WooCommerce REST API.

ВНИМАНИЕ: на текущем шаге доступны ТОЛЬКО операции чтения (READ).
Любые write-операции (create/update/delete/upload) НЕ реализованы намеренно
(docs/SECURITY_RULES.md: по умолчанию Dry Run, запись только после подтверждения).

Ключи берутся из config/.env через config_manager (без хардкода).
Сеть нестабильна (VPN) → ретраи.
Запуск самопроверки: python src/woocommerce/woocommerce_client.py
"""
from __future__ import annotations

import sys
import time
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from core.config_manager import config  # noqa: E402
from core.logger import get_logger  # noqa: E402

log = get_logger("woocommerce_client")

import os
RETRIES = int(os.environ.get("WOO_RETRIES", "8"))
TIMEOUT = int(os.environ.get("WOO_TIMEOUT", "60"))
BACKOFF_BASE = float(os.environ.get("WOO_BACKOFF", "3"))
BACKOFF_CAP = 60.0


def _request_with_backoff(method: str, url: str, *, auth, params=None, json=None, timeout=None):
    """HTTP с ретраями и экспоненциальным backoff (нестабильная сеть = норма, docs/NETWORK_POLICY.md).
    Бросает исключение только после исчерпания всех попыток."""
    last = None
    for attempt in range(RETRIES):
        try:
            return requests.request(method, url, auth=auth, params=params,
                                    json=json, timeout=timeout or TIMEOUT)
        except requests.exceptions.RequestException as e:
            last = e
            wait = min(BACKOFF_BASE * (2 ** attempt), BACKOFF_CAP)
            log.warning("сеть %s, попытка %d/%d: %s → ждём %.0fс",
                        method, attempt + 1, RETRIES, type(e).__name__, wait)
            time.sleep(wait)
    raise last


class WooReadClient:
    """Только чтение. Никаких изменений каталога."""

    def __init__(self) -> None:
        self.base = config.require("WOO_BASE").rstrip("/")
        self.auth = (config.require("WOO_CK"), config.require("WOO_CS"))

    def _get(self, path: str, params: dict | None = None):
        """GET с ретраями и экспоненциальным backoff. Разрешён только GET."""
        url = path if path.startswith("http") else f"{self.base}{path}"
        return _request_with_backoff("GET", url, params=params, auth=self.auth)

    # ----------------------------- READ методы -----------------------------
    def get_product(self, product_id: int) -> dict:
        return self._get(f"/products/{product_id}").json()

    def search_products(self, query: str, per_page: int = 10) -> list[dict]:
        r = self._get("/products", params={"search": query, "per_page": per_page})
        data = r.json()
        return data if isinstance(data, list) else []

    def list_categories(self, per_page: int = 100) -> list[dict]:
        cats: list[dict] = []
        for page in range(1, 6):
            r = self._get("/products/categories", params={"per_page": per_page, "page": page})
            chunk = r.json()
            if not isinstance(chunk, list) or not chunk:
                break
            cats.extend(chunk)
            if len(chunk) < per_page:
                break
        return cats

    def get_category(self, category_id: int) -> dict:
        return self._get(f"/products/categories/{category_id}").json()

    def list_product_images(self, product_id: int) -> list[dict]:
        return self.get_product(product_id).get("images", [])

    def get_product_attributes(self, product_id: int) -> list[dict]:
        return self.get_product(product_id).get("attributes", [])


def _selftest() -> int:
    """READ-самопроверка: категории + поиск. Никаких изменений сайта."""
    try:
        client = WooReadClient()
    except RuntimeError as e:
        log.error("Нет ключей: %s", e)
        return 1

    cats = client.list_categories()
    log.info("=== WOO READ SELFTEST ===")
    log.info("Получено категорий: %d", len(cats))
    for c in cats[:5]:
        log.info("   id=%s | %s | товаров=%s", c.get("id"), c.get("name"), c.get("count"))

    found = client.search_products("Uno plus", per_page=5)
    log.info("Поиск 'Uno plus': найдено %d", len(found))
    for p in found[:5]:
        log.info("   id=%s | %s | цена=%s | фото=%d",
                 p.get("id"), p.get("name"), p.get("price"), len(p.get("images", [])))

    log.info("Write-методов в клиенте НЕТ (только GET).")
    return 0


if __name__ == "__main__":
    raise SystemExit(_selftest())
