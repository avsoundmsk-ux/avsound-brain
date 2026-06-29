/**
 * Полная схема БД AV Studio (Drizzle / Postgres).
 * Принцип: вся критичная логика (баланс, цены, ключи) — backend.
 * Баланс = сумма immutable-записей credit_ledger (не редактируется напрямую).
 *
 * Auth-таблицы (user/session/account/verification/two_factor) — формат better-auth.
 * better-auth владеет ими; бизнес-таблицы ссылаются на user.id (text).
 */
import {
  pgTable, text, uuid, integer, bigint, boolean, timestamp, jsonb, pgEnum, index,
} from "drizzle-orm/pg-core";

// ---------- enums ----------
export const roleEnum = pgEnum("role", ["user", "admin", "owner"]);
export const userStatusEnum = pgEnum("user_status", ["active", "blocked"]);
export const ledgerTypeEnum = pgEnum("ledger_type", ["topup", "hold", "settle", "refund", "adjust", "bonus"]);
export const jobStatusEnum = pgEnum("job_status", ["created", "queued", "processing", "completed", "failed", "refunded"]);
export const modeEnum = pgEnum("mode", [
  "text_to_video", "image_to_video", "video_to_video",
  "image_generation", "image_editing", "audio", "voice", "document", "workflow",
]);
export const priceTypeEnum = pgEnum("price_type", ["fixed", "markup", "multiplier"]);
export const topupStatusEnum = pgEnum("topup_status", ["pending", "paid", "failed", "canceled"]);
export const payProviderEnum = pgEnum("pay_provider", ["yookassa", "stripe", "manual"]);

// ---------- auth (better-auth: text id) ----------
// better-auth core "user" + additionalFields (role/status/twoFactorEnabled).
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  // --- additionalFields (приложение) ---
  role: roleEnum("role").notNull().default("user"),
  status: userStatusEnum("status").notNull().default("active"),
  twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({ emailIdx: index("user_email_idx").on(t.email) }));

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// credentials (email/password argon2 hash в .password) + соц-аккаунты
export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// email verify / password reset (better-auth управляет)
export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// 2FA (TOTP) — плагин two-factor
export const twoFactor = pgTable("two_factor", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  secret: text("secret").notNull(),
  backupCodes: text("backup_codes").notNull(),
});

// ---------- провайдеры / модели / режимы / цены ----------
export const providers = pgTable("providers", {
  id: text("id").primaryKey(),                  // "modelark" | "kie" | ...
  title: text("title").notNull(),
  enabled: boolean("enabled").notNull().default(true),
});

export const models = pgTable("models", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: text("key").notNull().unique(),         // логич. id ("seedance-2")
  title: text("title").notNull(),
  providerId: text("provider_id").notNull().references(() => providers.id),
  providerModelId: text("provider_model_id").notNull(), // "dreamina-seedance-2-0-260128"
  enabled: boolean("enabled").notNull().default(true),
  meta: jsonb("meta"),                          // разрешения, лимиты и пр.
});

// цена за (модель, режим) — задаёт админ
export const priceRules = pgTable("price_rules", {
  id: uuid("id").defaultRandom().primaryKey(),
  modelId: uuid("model_id").notNull().references(() => models.id, { onDelete: "cascade" }),
  mode: modeEnum("mode").notNull(),
  priceType: priceTypeEnum("price_type").notNull(),  // fixed|markup|multiplier
  value: integer("value").notNull(),                 // fixed=кредиты; markup=+кредиты; multiplier=%×100 (200=×2)
  enabled: boolean("enabled").notNull().default(true),
  updatedBy: text("updated_by").references(() => user.id),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({ modelModeIdx: index("price_rules_model_mode_idx").on(t.modelId, t.mode) }));

// ---------- кредиты (immutable ledger) ----------
export const creditLedger = pgTable("credit_ledger", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  type: ledgerTypeEnum("type").notNull(),
  delta: integer("delta").notNull(),           // + начисление, − списание (в кредитах)
  balanceAfter: integer("balance_after").notNull(),
  jobId: uuid("job_id"),                        // связь с генерацией (hold/settle/refund)
  topupId: uuid("topup_id"),
  note: text("note"),
  createdBy: text("created_by").references(() => user.id), // админ для adjust
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({ userIdx: index("ledger_user_idx").on(t.userId, t.createdAt) }));

// ---------- пополнения ----------
export const topups = pgTable("topups", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  payProvider: payProviderEnum("pay_provider").notNull(),
  amountMinor: bigint("amount_minor", { mode: "number" }).notNull(), // в копейках/центах
  currency: text("currency").notNull().default("RUB"),
  credits: integer("credits").notNull(),       // сколько кредитов начислить
  status: topupStatusEnum("status").notNull().default("pending"),
  externalId: text("external_id"),             // id платежа у провайдера
  webhookVerified: boolean("webhook_verified").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  paidAt: timestamp("paid_at"),
});

// ---------- jobs (генерации) ----------
export const jobs = pgTable("jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  modelId: uuid("model_id").notNull().references(() => models.id),
  mode: modeEnum("mode").notNull(),
  status: jobStatusEnum("status").notNull().default("created"),
  prompt: text("prompt").notNull(),
  params: jsonb("params"),                      // duration, resolution, inputImages...
  // экономика (в кредитах)
  costCredits: integer("cost_credits"),         // себестоимость (по факту провайдера)
  priceCredits: integer("price_credits").notNull(), // цена клиенту (списано)
  profitCredits: integer("profit_credits"),     // price − cost
  // результат
  providerTaskId: text("provider_task_id"),
  outputUrl: text("output_url"),
  error: text("error"),
  attempts: integer("attempts").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
}, (t) => ({ userIdx: index("jobs_user_idx").on(t.userId, t.createdAt), statusIdx: index("jobs_status_idx").on(t.status) }));

export const jobLogs = pgTable("job_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  level: text("level").notNull().default("info"),
  message: text("message").notNull(),
  data: jsonb("data"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------- продукт: промты, шаблоны, папки ----------
export const promptLibrary = pgTable("prompt_library", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }), // null = общий
  title: text("title").notNull(),
  prompt: text("prompt").notNull(),
  tags: jsonb("tags"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const folders = pgTable("folders", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
});

export const favorites = pgTable("favorites", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  folderId: uuid("folder_id").references(() => folders.id, { onDelete: "set null" }),
});

export const promoCodes = pgTable("promo_codes", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  credits: integer("credits").notNull(),
  maxUses: integer("max_uses").notNull().default(1),
  uses: integer("uses").notNull().default(0),
  expiresAt: timestamp("expires_at"),
  enabled: boolean("enabled").notNull().default(true),
});

// ---------- админ-аудит ----------
export const adminAudit = pgTable("admin_audit", {
  id: uuid("id").defaultRandom().primaryKey(),
  adminId: text("admin_id").notNull().references(() => user.id),
  action: text("action").notNull(),            // "refund", "block_user", "set_price"...
  targetType: text("target_type"),
  targetId: text("target_id"),
  data: jsonb("data"),
  ip: text("ip"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
