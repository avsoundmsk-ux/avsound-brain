# AV Studio — Security Ledger

Реестр security-находок (аудит 2026-06-27, агент security-reviewer) и их статус.
Обновлять при каждом security-ревью.

## ✅ Исправлено (P1, 2026-06-27)
| ID | Находка | Фикс |
|---|---|---|
| C-4 | verify/reset токены в логах | `email.ts` — убран `mail.text` из лога |
| H-3 | secret/url без валидации | `src/env.ts` — secret обязателен ≥32, url валидный, fail-fast |
| H-4 | роль через unsafe as-cast | `guards.ts` — `normalizeRole()` runtime, неизвестное → "user" |
| C-1 | X-Forwarded-For спуфинг | `rate-limit.ts` — только `x-vercel-forwarded-for`/`x-real-ip`, fallback "unknown" |
| L-4 | нет security headers | `next.config.ts` — X-Frame-Options/nosniff/Referrer/Permissions |

## ⛔ БЛОКЕРЫ PRODUCTION (исправить до prod-деплоя)
| ID | Находка | Действие до prod |
|---|---|---|
| C-2/M-2 | in-memory rate-limit фиктивен на serverless | заменить на durable store: Upstash Redis или Postgres-таблица; better-auth `rateLimit.storage: "database"`. **DEV-only сейчас.** |
| C-3 | 2FA `secret`/`backupCodes` в plaintext (`two_factor`) | secret → AES-256-GCM (ключ env), backupCodes → argon2-хеши. **Менять схему ДО первой prod-миграции.** |
| C-1 (worker) | X-Forwarded-For на Hetzner-worker | убедиться, что Nginx/HAProxy ставит `x-real-ip`, прямой Node не читает клиентский XFF |

## 🕓 Отложено осознанно (другие фазы)
| ID | Находка | Когда |
|---|---|---|
| H-1 | open-redirect через `?redirect=` | при создании sign-in страницы (P6): валидировать redirect — начинается с `/`, не `//` |
| H-2 | оптимистичный cookie-гейт middleware | при создании `/admin`,`/owner` layout — обязательный `requireRole` в layout.tsx |
| H-5 | autoSignInAfterVerification + логи | закроется с SMTP (C-4 уже убрал логи); проверить одноразовость verify-токена |
| M-1 | CSRF отклоняет server-to-server/mobile | при появлении worker→API или мобильного клиента: `/api/internal/*` + Bearer secret |
| M-3 | нет edge-WAF на /api/auth | Vercel Firewall rule на sign-in/forget-password |
| M-4 | promoCodes race | P2/P6: атомарный `UPDATE ... WHERE uses < max_uses` + таблица использований |
| M-5 | creditLedger без CHECK/FOR UPDATE | P2 (кредиты): `CHECK(balance_after>=0)` + `SELECT ... FOR UPDATE` в транзакции |
| M-6 | admin/owner не разграничены в middleware | layout-guard + тест на `app/owner/**` |
| L-1 | jobLogs jsonb retention | P7: схема data + TTL-очистка |
| L-2 | twoFactor() без issuer | `twoFactor({ issuer: "AV Studio" })` |
| L-3 | adminAudit без индекса | `index(adminId, createdAt)` |
| L-5 | role без нормализации в /api/me | применить `normalizeRole` в ответе |

## Принципы
- Вся критичная логика (баланс, цены, ключи, роли) — server-only.
- Баланс = сумма immutable `credit_ledger`, не редактируется напрямую.
- Роль/статус валидируются в рантайме, не доверяем форме объекта.
- Rate-limit/CSRF — defense in depth, не единственный барьер.
