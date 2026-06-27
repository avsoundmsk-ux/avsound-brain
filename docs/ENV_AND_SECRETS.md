# ENV_AND_SECRETS.md

Список секретов и переменных окружения. Ключи только в `.env`, НИКОГДА в коде/гите.

# Переменные (.env)
| Переменная | Сервис | Назначение | Обяз. |
|---|---|---|---|
| WOO_CK | WooCommerce | Consumer Key (ck_…) | да |
| WOO_CS | WooCommerce | Consumer Secret (cs_…) | да |
| WOO_BASE | WooCommerce | базовый URL API (`https://av-sound.ru/wp-json/wc/v3`) | да |
| KIE_API_KEY | KIE.ai | генерация изображений | да |
| BRAVE_KEY | Brave Search | поиск фото/страниц товара | да |
| OPENROUTER_KEY / LLM_KEY | LLM | описания/характеристики (опц.) | нет |
| BUDGET_USD | Budget Guard | лимит трат на запуск (по умолч. 5) | нет |

# Где сейчас лежат (факт)
- WooCommerce ck/cs, KIE, Brave — продублированы в памяти `api-keys.md`. Перенести в `.env` проекта; из кода читать только через `config_manager`/`os.environ`.
- Текущий `tools/woo.py` имеет ключи как **fallback в коде** — это временно; в новом проекте хардкод запрещён.

# Правила
- `.env` обязательно в `.gitignore`. Коммитить только `.env.example` (имена без значений).
- Никогда не логировать значения ключей (маскировать `ck_****`).
- Ротация при любой утечке (был инцидент с утечкой .env в GitHub — ключи ротировались).
- Все клиенты берут ключи через config_manager; прямого `os.environ` в бизнес-логике избегать.
- WooCommerce ключи — права **Read/Write** (нужны для обновления товаров/фото).

# .env.example (шаблон для репозитория)
```
WOO_BASE=https://av-sound.ru/wp-json/wc/v3
WOO_CK=
WOO_CS=
KIE_API_KEY=
BRAVE_KEY=
LLM_KEY=
BUDGET_USD=5
```

# Открытые вопросы
- хранить ли .env на сервере (Hetzner) для крон-запусков;
- единый секрет-менеджер в будущем (vault) при масштабировании.
