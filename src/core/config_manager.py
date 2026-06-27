"""
config_manager — единая загрузка настроек проекта.

Источники (по приоритету): переменные окружения > config/.env > значения по умолчанию.
Секреты только из окружения/.env, в коде не хранятся (docs/ENV_AND_SECRETS.md).
Без сторонних зависимостей: .env парсится вручную.
"""
from __future__ import annotations

import os
from pathlib import Path

# Корень проекта = на два уровня выше этого файла (src/core/ -> проект).
PROJECT_ROOT = Path(__file__).resolve().parents[2]
CONFIG_DIR = PROJECT_ROOT / "config"
ENV_FILE = CONFIG_DIR / ".env"

# Имена ожидаемых ключей и значения по умолчанию (не-секретные).
DEFAULTS = {
    "WOO_BASE": "https://av-sound.ru/wp-json/wc/v3",
    "BUDGET_USD": "5",
}
SECRET_KEYS = {"WOO_CK", "WOO_CS", "KIE_API_KEY", "BRAVE_KEY", "LLM_KEY"}


def _parse_env_file(path: Path) -> dict[str, str]:
    """Прочитать .env (KEY=VALUE, # — комментарий). Отсутствие файла не ошибка."""
    data: dict[str, str] = {}
    if not path.exists():
        return data
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        data[key.strip()] = value.strip().strip('"').strip("'")
    return data


class Config:
    """Доступ к настройкам. Значения берутся лениво, секреты не логируются."""

    def __init__(self) -> None:
        self._file_values = _parse_env_file(ENV_FILE)

    def get(self, key: str, default: str | None = None) -> str | None:
        """Окружение > .env > DEFAULTS > переданный default."""
        if key in os.environ and os.environ[key] != "":
            return os.environ[key]
        if self._file_values.get(key):
            return self._file_values[key]
        if key in DEFAULTS:
            return DEFAULTS[key]
        return default

    def require(self, key: str) -> str:
        """Вернуть значение или явно упасть, если ключ не задан."""
        value = self.get(key)
        if not value:
            raise RuntimeError(
                f"Не задан обязательный параметр {key}. "
                f"Заполните config/.env (см. config/.env.example)."
            )
        return value

    @property
    def budget_usd(self) -> float:
        try:
            return float(self.get("BUDGET_USD", "5") or 5)
        except ValueError:
            return 5.0

    def status(self) -> dict[str, str]:
        """Карта 'какие ключи заданы' БЕЗ раскрытия значений (для диагностики)."""
        result: dict[str, str] = {}
        for key in list(DEFAULTS) + sorted(SECRET_KEYS):
            value = self.get(key)
            if key in SECRET_KEYS:
                result[key] = "set" if value else "MISSING"
            else:
                result[key] = value or "MISSING"
        return result


# Готовый singleton для импорта.
config = Config()


if __name__ == "__main__":
    print(f"PROJECT_ROOT: {PROJECT_ROOT}")
    print(f".env найден: {ENV_FILE.exists()}  ({ENV_FILE})")
    print("Статус ключей (значения секретов скрыты):")
    for key, state in config.status().items():
        print(f"  {key}: {state}")
    print(f"Бюджет на запуск: ${config.budget_usd}")
