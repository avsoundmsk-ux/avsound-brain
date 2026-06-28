/**
 * Пакеты кредитов (фиксированные). amountMinor — в копейках (RUB).
 * 1 кредит ≈ 1 ₽ (с пакетными скидками). Меняется здесь, не в БД.
 */
export interface CreditPackage {
  id: string;
  title: string;
  credits: number;
  amountMinor: number; // копейки
  currency: "RUB";
}

export const PACKAGES: CreditPackage[] = [
  { id: "p500", title: "Старт", credits: 500, amountMinor: 50000, currency: "RUB" },
  { id: "p1000", title: "Базовый", credits: 1000, amountMinor: 95000, currency: "RUB" },
  { id: "p2000", title: "Про", credits: 2000, amountMinor: 180000, currency: "RUB" },
  { id: "p5000", title: "Студия", credits: 5000, amountMinor: 425000, currency: "RUB" },
];

export function getPackage(id: string): CreditPackage | undefined {
  return PACKAGES.find((p) => p.id === id);
}
