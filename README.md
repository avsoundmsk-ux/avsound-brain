# AVSound — AI-мозг студии автозвука

Telegram-бот на **GramJS** (Node.js) с **Claude** в роли мозга.  
Управляет клиентами, генерирует контент, отвечает на вопросы по прайсу и услугам.

## Архитектура

```
Telegram (GramJS) → Claude API → База знаний (md-файлы)
                              ↓
                     Агенты-специалисты:
                     - Продажи / квалификация лидов
                     - Контент / посты
                     - CRM / клиенты
                     - Склад / оборудование
```

## Стек

| Компонент | Технология |
|-----------|------------|
| Telegram-клиент | [GramJS](https://github.com/gram-js/gramjs) |
| AI-мозг | Claude API (`claude-sonnet-4-6`) |
| База знаний | Markdown-файлы (business/, marketing/, products_db/) |
| Хранилище сессий | JSON / SQLite |
| Деплой | Node.js сервер / PM2 |

## Структура

```
src/          — исходный код бота и агентов
config/       — конфиги, промпты, настройки
docs/         — документация и схемы
logs/         — логи сессий и диалогов
business/     — клиенты, прайс, услуги, конкуренты
marketing/    — контент-стратегия, посты, Avito, Telegram
studio/       — кейсы установок, оборудование
products_db/  — база товаров по категориям
plans/        — задачи, роадмап, идеи
owner/        — профиль владельца и цели
```

## Быстрый старт

```bash
npm install
cp config/.env.example config/.env
# Заполнить TELEGRAM_API_ID, TELEGRAM_API_HASH, ANTHROPIC_API_KEY
npm start
```

## Переменные окружения

```
TELEGRAM_API_ID=       # из my.telegram.org
TELEGRAM_API_HASH=     # из my.telegram.org
TELEGRAM_BOT_TOKEN=    # из @BotFather
ANTHROPIC_API_KEY=     # из console.anthropic.com
```

## Владелец

**Михаил Автономов** — AVSound, студия автозвука, Москва
