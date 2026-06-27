"""
budget_guard — лимиты запросов и бюджета на один запуск (docs/BUDGET_LIMITS.md).

Сейчас фактических трат нет (KIE не подключён) — счётчики нулевые,
но архитектура заложена: проверка перед тратой, hard-stop при превышении.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from core.config_manager import config  # noqa: E402
from core.logger import get_logger  # noqa: E402

log = get_logger("budget_guard")

KIE_COST_PER_IMAGE = 0.02  # ~4 cr; для будущего KIE


class BudgetExceeded(Exception):
    pass


class BudgetGuard:
    def __init__(self, limit_usd: float | None = None) -> None:
        self.limit_usd = limit_usd if limit_usd is not None else config.budget_usd
        self.spent_usd = 0.0
        self.requests = 0
        self.images = 0

    def count_request(self, n: int = 1) -> None:
        self.requests += n

    def can_spend(self, amount_usd: float) -> bool:
        return (self.spent_usd + amount_usd) <= self.limit_usd

    def charge(self, amount_usd: float, images: int = 0) -> None:
        """Списать бюджет. При превышении — hard-stop (исключение)."""
        if not self.can_spend(amount_usd):
            log.error("Превышен бюджет: потрачено $%.2f, лимит $%.2f, попытка +$%.2f",
                      self.spent_usd, self.limit_usd, amount_usd)
            raise BudgetExceeded(f"limit ${self.limit_usd}")
        self.spent_usd += amount_usd
        self.images += images
        if self.spent_usd >= self.limit_usd * 0.8:
            log.warning("80%% бюджета использовано: $%.2f / $%.2f", self.spent_usd, self.limit_usd)

    def charge_kie_image(self, count: int = 1) -> None:
        self.charge(KIE_COST_PER_IMAGE * count, images=count)

    def stats(self) -> dict:
        return {"limit_usd": self.limit_usd, "spent_usd": round(self.spent_usd, 4),
                "requests": self.requests, "images": self.images}


if __name__ == "__main__":
    g = BudgetGuard()
    print("старт:", g.stats())
    g.count_request(5)
    g.charge_kie_image(3)   # $0.06
    print("после 3 картинок KIE + 5 запросов:", g.stats())
