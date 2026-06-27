# AV AI Studio — архитектура платформы (на согласование)

Статус: АНАЛИЗ + ПЛАН. Код — после подтверждения. Дата: 2026-06-27.

## 1. Анализ open-source основ

| Кандидат | Лицензия | Что даёт | Вердикт |
|---|---|---|---|
| **Vercel `nextjs/saas-starter`** | MIT | Next15 App Router, Postgres+Drizzle, Stripe, RBAC (owner/member), activity log, auth | ✅ **скелет** auth/payments/dashboard. Но подписочный (не кредиты) → кредиты/jobs дописываем |
| ai-saas-starter / next-app-ai-saas (разные) | в осн. MIT | обёртки Replicate/OpenAI, наивные «кредиты» | ❌ как ядро: привязка к 1 провайдеру, нет refund/restart/себестоимости |
| open-generative-ai / awesome-generative-ai-apps | — | это **списки** репозиториев, не基а | 📚 источник идей/промтов, не фундамент |
| Makerkit / ShipFast | платные/closed | всё включено | ❌ лицензия/деньги |

**Решение:** НЕ брать тяжёлый AI-SaaS-темплейт (риск лицензии/качества/lock-in). **Гибрид:**
- скучную часть (auth, payments, dashboard-каркас, activity-log) — с проверенного MIT-скелета (Vercel saas-starter как референс, не копипаст);
- ядро (provider→model→mode→price→job, кредиты, refund, себестоимость) — **наше, кастом** (темплейты это делают плохо);
- **переиспользуем уже готовый `ai-hub/`** (provider-абстракция, ModelArk Seedance 2.0 РАБОТАЕТ, pricing) — это Phase 0, уже сделано.

## 2. Рекомендуемый стек
- **Next.js 15 (App Router) + TypeScript** — UI + серверные API-роуты (вся критичная логика server-only).
- **PostgreSQL + Drizzle ORM** — типобезопасно, миграции.
- **Auth: better-auth** — email verification, password reset, роли (user/admin/owner), **2FA (TOTP)**, rate-limit из коробки. (Альтернатива Auth.js — слабее по 2FA/ролям.)
- **Очередь: pg-boss** (на Postgres, без Redis) для MVP — retry/timeout/restart/задержки. BullMQ+Redis — если вырастет нагрузка.
- **Платежи:** ⚠️ Stripe для РФ-карт не работает. Для России — **ЮKassa / CloudPayments**. Решить (вопрос ниже).
- **Хранилище:** S3-совместимое (Cloudflare R2 / Backblaze B2) + signed URLs; mime/size-проверки.
- **AI-ядро:** наш `ai-hub` (ModelArk + KIE), обёрнут сервисом.
- **Деплой:** вариант А — Vercel (UI/API) + worker на Hetzner; вариант Б — всё на твоём Hetzner в Docker. (вопрос ниже).
- Безопасность: argon2 (пароли), zod-валидация, CSRF, helmet/CORS, верификация подписи webhook оплаты, журнал админа.

## 3. Архитектура

### Доменная модель (provider → model → mode → price → job)
Таблицы Postgres:
- `users` (роль, 2fa_secret, статус, email_verified)
- `sessions`
- `providers` (modelark, kie, openai…) + `provider_keys` (зашифровано, только backend)
- `models` (id, provider_id, тип) · `model_modes` (t2v/i2v/v2v/image/edit/audio…)
- `price_rules` (model_id, mode, тип: fixed|markup|multiplier, значение)
- `credit_ledger` (immutable: user_id, delta, тип: topup|hold|settle|refund, job_id, balance_after) — баланс = сумма
- `topups` (provider оплаты, сумма, статус, webhook_verified)
- `jobs` (user_id, model, mode, params, status, cost_credits, price_credits, profit_credits, output_url, error)
- `job_logs`, `admin_audit`, `prompts_library`, `templates`, `promo_codes`

### Денежная логика (только backend)
- **Себестоимость (cost)** — из провайдера (ai-hub pricing, реальные токены ModelArk).
- **Цена клиенту (price)** — `price_rules`: fixed / markup(+X) / multiplier(×2,×3).
- **Прибыль** = price − cost (видна в админке/истории).
- **Поток:** калькулятор показывает price ДО → проверка баланса → **hold** (резерв кредитов) → job в очередь → success: **settle** (списать) / fail: **refund** (вернуть hold). Всё через `credit_ledger`, баланс не редактируется напрямую.

### Слои
UI (Next) → API-роуты (auth+zod) → сервисы (`CreditService`, `PricingService`, `JobService`, `ModelService`) → `ai-hub` провайдеры → DB / queue / storage.
**Frontend не решает ничего критичного** — только показывает.

### Жизненный цикл job
`created → (credits reserved) → queued → processing → completed(settle) / failed(refund)`.
Поддержка retry, timeout, ручной restart из админки, логи ошибок.

## 4. Phased Roadmap
- **Phase 0 — AI-ядро** ✅ сделано: `ai-hub` (ModelArk Seedance 2.0 работает, KIE fallback, pricing).
- **Phase 1 — Фундамент:** Next15 scaffold, Postgres+Drizzle схема, better-auth (verify/reset/роли), .env, базовая безопасность.
- **Phase 2 — Кредиты + цены:** `credit_ledger`, `price_rules`, калькулятор, проверка баланса, hold/settle/refund.
- **Phase 3 — Генерация MVP:** интеграция ai-hub, очередь pg-boss, статусы, история, retry/timeout/refund, S3-хранилище. Первая модель — `dreamina-seedance-2-0-260128` (t2v).
- **Phase 4 — Платежи:** пополнение (ЮKassa/Stripe), webhook + проверка подписи → topup в ledger.
- **Phase 5 — Админка:** пользователи/балансы/пополнения/списания/jobs(restart)/модели/цены/прибыль/refund/блокировка/audit, 2FA для admin/owner.
- **Phase 6 — Продукт-UX:** калькулятор, история, повтор, копировать промт, библиотека промтов, шаблоны, папки/избранное, промокоды.
- **Phase 7 — Харднинг:** rate-limit, anti-brute-force, бэкапы БД, мониторинг, режимы i2v/v2v/image/audio.

## 5. Решения до старта (нужен твой выбор)
1. **Платёжка:** ЮKassa/CloudPayments (РФ-карты) vs Stripe (межд.) vs обе.
2. **Деплой:** твой Hetzner (Docker) vs Vercel+worker.
3. **Очередь:** pg-boss (просто, без Redis) vs BullMQ+Redis.
4. **ai-hub:** переиспользовать как есть (импорт) vs влить код в новый монорепо.
