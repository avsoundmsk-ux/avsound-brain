/**
 * PricingService — расчёт цены клиенту в кредитах.
 * Кредит — внутренняя валюта платформы. CREDIT_USD = стоимость 1 кредита в USD при продаже.
 * Себестоимость (USD от провайдера) → costCredits → цена по правилу админа.
 */
export const CREDIT_USD = 0.01; // 1 кредит = $0.01 → $5 = 500 кредитов

export type PriceType = "fixed" | "markup" | "multiplier";
export interface PriceRule { priceType: PriceType; value: number; }

/** USD себестоимости → кредиты себестоимости (вверх, чтобы не уйти в минус). */
export function costToCredits(costUsd: number): number {
  return Math.max(0, Math.ceil(costUsd / CREDIT_USD));
}

/**
 * Цена клиенту в кредитах.
 *  fixed      → value (фикс. кредиты, себестоимость игнор)
 *  markup     → costCredits + value (наценка в кредитах)
 *  multiplier → costCredits * value / 100 (200 = ×2)
 */
export function computePrice(costCredits: number, rule: PriceRule): number {
  switch (rule.priceType) {
    case "fixed": return Math.max(0, Math.round(rule.value));
    case "markup": return Math.max(0, costCredits + Math.round(rule.value));
    case "multiplier": return Math.max(0, Math.round((costCredits * rule.value) / 100));
  }
}

export interface Quote {
  costUsd: number;
  costCredits: number;
  priceCredits: number;
  profitCredits: number;
  priceUsd: number;
}

/** Полная котировка для калькулятора «цена ДО запуска». */
export function quote(costUsd: number, rule: PriceRule): Quote {
  const costCredits = costToCredits(costUsd);
  const priceCredits = computePrice(costCredits, rule);
  return {
    costUsd,
    costCredits,
    priceCredits,
    profitCredits: priceCredits - costCredits,
    priceUsd: +(priceCredits * CREDIT_USD).toFixed(2),
  };
}
