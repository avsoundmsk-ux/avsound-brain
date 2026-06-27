"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/auth/client";

type Quote = { priceCredits: number; priceUsd: number; costCredits: number; profitCredits: number };

export function DashboardUI({ email, role, balance }: { email: string; role: string; balance: number }) {
  const router = useRouter();
  const isStaff = role === "admin" || role === "owner";
  const [mode, setMode] = useState("text_to_video");
  const [dur, setDur] = useState(5);
  const [res, setRes] = useState("720p");
  const [q, setQ] = useState<Quote | null>(null);
  const [err, setErr] = useState("");

  async function calc() {
    setErr(""); setQ(null);
    const r = await fetch("/api/pricing/quote", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelKey: "seedance-2", mode, durationSec: dur, resolution: res }),
    });
    const d = await r.json();
    if (!r.ok) return setErr(d.error || "ошибка");
    setQ(d);
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Личный кабинет</h1>
        <button onClick={async () => { await signOut(); router.push("/"); }} style={ghost}>Выйти</button>
      </div>
      <p style={{ color: "#8b93a3" }}>{email} · роль: <b>{role}</b></p>

      <div style={card}>
        <div style={{ color: "#8b93a3", fontSize: 13 }}>Баланс</div>
        <div style={{ fontSize: 36, fontWeight: 800, color: "#ffd23f" }}>{balance} <span style={{ fontSize: 16 }}>кредитов</span></div>
        <div style={{ color: "#8b93a3", fontSize: 13 }}>≈ ${(balance * 0.01).toFixed(2)}</div>
      </div>

      <div style={card}>
        <h3 style={{ marginTop: 0 }}>Калькулятор цены (Seedance 2.0)</h3>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <select value={mode} onChange={(e) => setMode(e.target.value)} style={sel}>
            <option value="text_to_video">text-to-video</option>
            <option value="image_to_video">image-to-video</option>
          </select>
          <select value={res} onChange={(e) => setRes(e.target.value)} style={sel}>
            <option>480p</option><option>720p</option><option>1080p</option>
          </select>
          <input type="number" min={4} max={15} value={dur} onChange={(e) => setDur(+e.target.value)} style={{ ...sel, width: 80 }} />
          <button onClick={calc} style={primary}>Рассчитать</button>
        </div>
        {err && <div style={{ color: "#ff5c5c", marginTop: 10 }}>{err}</div>}
        {q && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 22, fontWeight: 700 }}>Цена: {q.priceCredits} кр (${q.priceUsd})</div>
            <div style={{ color: balance >= q.priceCredits ? "#5cd68a" : "#ff5c5c", fontSize: 13 }}>
              {balance >= q.priceCredits ? "Баланса хватает ✓" : "Недостаточно баланса"}
            </div>
            {isStaff && (
              <div style={{ color: "#8b93a3", fontSize: 13, marginTop: 6 }}>
                себестоимость {q.costCredits} кр · прибыль {q.profitCredits} кр
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

const card: React.CSSProperties = { background: "#161a22", border: "1px solid #2a313d", borderRadius: 14, padding: 20, marginTop: 20 };
const sel: React.CSSProperties = { padding: 10, borderRadius: 8, border: "1px solid #2a313d", background: "#1d222c", color: "#e6e9ef" };
const primary: React.CSSProperties = { padding: "10px 18px", borderRadius: 8, border: "none", background: "#ffd23f", color: "#1a1a1a", fontWeight: 700, cursor: "pointer" };
const ghost: React.CSSProperties = { padding: "8px 14px", borderRadius: 8, border: "1px solid #2a313d", background: "transparent", color: "#e6e9ef", cursor: "pointer" };
