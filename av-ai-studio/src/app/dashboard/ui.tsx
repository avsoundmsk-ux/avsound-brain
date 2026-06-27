"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/auth/client";

type Quote = { priceCredits: number; priceUsd: number; costCredits: number; profitCredits: number };
type Job = { id: string; status: string; prompt: string; outputUrl: string | null; priceCredits: number; createdAt: string };

export function DashboardUI({ email, role, balance }: { email: string; role: string; balance: number }) {
  const router = useRouter();
  const isStaff = role === "admin" || role === "owner";
  const [mode, setMode] = useState("text_to_video");
  const [dur, setDur] = useState(5);
  const [res, setRes] = useState("720p");
  const [q, setQ] = useState<Quote | null>(null);
  const [err, setErr] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);

  const loadJobs = useCallback(async () => {
    const r = await fetch("/api/jobs");
    if (r.ok) setJobs(await r.json());
  }, []);
  useEffect(() => { loadJobs(); }, [loadJobs]);

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

      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>История генераций</h3>
          <button onClick={loadJobs} style={ghost}>Обновить</button>
        </div>
        {jobs.length === 0 && <p style={{ color: "#8b93a3" }}>Пока пусто.</p>}
        {jobs.map((j) => (
          <div key={j.id} style={{ borderTop: "1px solid #2a313d", padding: "10px 0", display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div style={{ overflow: "hidden" }}>
              <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{j.prompt}</div>
              <div style={{ fontSize: 12, color: "#8b93a3" }}>{j.priceCredits} кр · {new Date(j.createdAt).toLocaleString("ru")}</div>
            </div>
            <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
              <span style={{ color: statusColor(j.status), fontWeight: 700 }}>{j.status}</span>
              {j.outputUrl && <div><a href={j.outputUrl} target="_blank" style={{ color: "#ffd23f", fontSize: 12 }}>результат</a></div>}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

function statusColor(s: string): string {
  return s === "completed" ? "#5cd68a" : s === "failed" ? "#ff5c5c" : "#ffd23f";
}

const card: React.CSSProperties = { background: "#161a22", border: "1px solid #2a313d", borderRadius: 14, padding: 20, marginTop: 20 };
const sel: React.CSSProperties = { padding: 10, borderRadius: 8, border: "1px solid #2a313d", background: "#1d222c", color: "#e6e9ef" };
const primary: React.CSSProperties = { padding: "10px 18px", borderRadius: 8, border: "none", background: "#ffd23f", color: "#1a1a1a", fontWeight: 700, cursor: "pointer" };
const ghost: React.CSSProperties = { padding: "8px 14px", borderRadius: 8, border: "1px solid #2a313d", background: "transparent", color: "#e6e9ef", cursor: "pointer" };
