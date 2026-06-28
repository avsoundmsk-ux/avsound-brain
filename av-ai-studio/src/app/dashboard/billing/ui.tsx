"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type Pkg = { id: string; title: string; credits: number; amountMinor: number; currency: string };
type Topup = { id: string; status: string; credits: number; amountMinor: number; createdAt: string };

const card: React.CSSProperties = { background: "#161a22", border: "1px solid #2a313d", borderRadius: 14, padding: 20, marginTop: 16 };
const btn: React.CSSProperties = { padding: "8px 14px", borderRadius: 8, border: "none", background: "#ffd23f", color: "#1a1a1a", fontWeight: 700, cursor: "pointer" };
const ghost: React.CSSProperties = { padding: "6px 12px", borderRadius: 8, border: "1px solid #2a313d", background: "#1d222c", color: "#e6e9ef", cursor: "pointer", fontSize: 13 };

async function post(url: string, body: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return r.json();
}

export function BillingUI({ balance: initial, devMode }: { balance: number; devMode: boolean }) {
  const [balance, setBalance] = useState(initial);
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [topups, setTopups] = useState<Topup[]>([]);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const d = await (await fetch("/api/topups")).json();
    setPackages(d.packages ?? []);
    setTopups(d.topups ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function buy(pkgId: string) {
    setMsg("");
    const t = await post("/api/topups", { packageId: pkgId });
    if (t.error) return setMsg(t.error);
    setMsg(`Счёт создан (pending). ${devMode ? "Нажми «подтвердить» ниже." : "Перейдите к оплате."}`);
    load();
  }
  async function confirm(topupId: string) {
    const r = await post("/api/topups/confirm", { topupId });
    if (r.error) return setMsg(r.error);
    if (typeof r.balance === "number") setBalance(r.balance);
    setMsg(r.credited ? "Оплата подтверждена, кредиты начислены ✓" : "Уже обработано");
    load();
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "32px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Пополнение баланса</h1>
        <Link href="/dashboard" style={{ ...ghost, textDecoration: "none" }}>← Кабинет</Link>
      </div>
      <div style={{ color: "#8b93a3" }}>Баланс: <b style={{ color: "#ffd23f" }}>{balance} кр</b></div>

      <div style={card}>
        <h3 style={{ marginTop: 0 }}>Пакеты</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 12 }}>
          {packages.map((p) => (
            <div key={p.id} style={{ border: "1px solid #2a313d", borderRadius: 10, padding: 14, textAlign: "center" }}>
              <div style={{ fontWeight: 700 }}>{p.title}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: "#ffd23f" }}>{p.credits}</div>
              <div style={{ color: "#8b93a3", fontSize: 13 }}>кредитов</div>
              <div style={{ margin: "8px 0" }}>{(p.amountMinor / 100).toFixed(0)} ₽</div>
              <button style={btn} onClick={() => buy(p.id)}>Купить</button>
            </div>
          ))}
        </div>
        {msg && <div style={{ marginTop: 12, color: "#5cd68a" }}>{msg}</div>}
        {devMode && <div style={{ marginTop: 8, color: "#8b93a3", fontSize: 12 }}>DEV-режим: оплата подтверждается кнопкой (без реальных денег). В проде — webhook ЮKassa/Stripe.</div>}
      </div>

      <div style={card}>
        <h3 style={{ marginTop: 0 }}>История пополнений</h3>
        {topups.length === 0 && <p style={{ color: "#8b93a3" }}>Пока пусто.</p>}
        {topups.map((t) => (
          <div key={t.id} style={{ borderTop: "1px solid #2a313d", padding: "10px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div>{t.credits} кр · {(t.amountMinor / 100).toFixed(0)} ₽</div>
              <div style={{ fontSize: 12, color: "#8b93a3" }}>{new Date(t.createdAt).toLocaleString("ru")}</div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ color: t.status === "paid" ? "#5cd68a" : t.status === "pending" ? "#ffd23f" : "#ff5c5c", fontWeight: 700 }}>{t.status}</span>
              {devMode && t.status === "pending" && <button style={ghost} onClick={() => confirm(t.id)}>подтвердить оплату</button>}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
