"use client";
import { useState, useEffect, useCallback } from "react";

type Tab = "stats" | "users" | "jobs" | "pricing";
const card: React.CSSProperties = { background: "#161a22", border: "1px solid #2a313d", borderRadius: 12, padding: 16, marginTop: 16 };
const btn: React.CSSProperties = { padding: "6px 12px", borderRadius: 8, border: "1px solid #2a313d", background: "#1d222c", color: "#e6e9ef", cursor: "pointer", fontSize: 13 };
const th: React.CSSProperties = { textAlign: "left", padding: "6px 8px", color: "#8b93a3", fontSize: 12, borderBottom: "1px solid #2a313d" };
const td: React.CSSProperties = { padding: "6px 8px", fontSize: 13, borderBottom: "1px solid #20262f" };

async function post(url: string, body: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return r.json();
}

export function AdminUI({ email, role }: { email: string; role: string }) {
  const [tab, setTab] = useState<Tab>("stats");
  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px" }}>
      <h1>Админка · <span style={{ color: "#8b93a3", fontSize: 16 }}>{email} ({role})</span></h1>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        {(["stats", "users", "jobs", "pricing"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{ ...btn, background: tab === t ? "#ffd23f" : "#1d222c", color: tab === t ? "#1a1a1a" : "#e6e9ef", fontWeight: tab === t ? 700 : 400 }}>{t}</button>
        ))}
      </div>
      {tab === "stats" && <Stats />}
      {tab === "users" && <Users />}
      {tab === "jobs" && <Jobs />}
      {tab === "pricing" && <Pricing canEditRole={role === "owner"} />}
    </main>
  );
}

function Stats() {
  const [d, setD] = useState<any>(null);
  useEffect(() => { fetch("/api/admin/stats").then((r) => r.json()).then(setD); }, []);
  if (!d?.stats) return <div style={card}>загрузка…</div>;
  const j = d.stats.jobs;
  return (
    <div style={card}>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        <Stat label="Пользователей" v={d.stats.users} />
        <Stat label="Генераций" v={j.total} />
        <Stat label="Успешных" v={j.completed} />
        <Stat label="Ошибок" v={j.failed} />
        <Stat label="Активных" v={j.active} />
        <Stat label="Выручка (кр)" v={j.revenue_credits} />
        <Stat label="Прибыль (кр)" v={j.profit_credits} hi />
        <Stat label="Себестоим. (кр)" v={j.cost_credits} />
      </div>
    </div>
  );
}
function Stat({ label, v, hi }: { label: string; v: number; hi?: boolean }) {
  return <div><div style={{ color: "#8b93a3", fontSize: 12 }}>{label}</div><div style={{ fontSize: 26, fontWeight: 800, color: hi ? "#5cd68a" : "#e6e9ef" }}>{v}</div></div>;
}

function Users() {
  const [rows, setRows] = useState<any[]>([]);
  const load = useCallback(() => { fetch("/api/admin/users").then((r) => r.json()).then((d) => setRows(Array.isArray(d) ? d : d.rows ?? [])); }, []);
  useEffect(() => { load(); }, [load]);
  return (
    <div style={card}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr><th style={th}>email</th><th style={th}>роль</th><th style={th}>статус</th><th style={th}>баланс</th><th style={th}>действия</th></tr></thead>
        <tbody>{rows.map((u) => (
          <tr key={u.id}>
            <td style={td}>{u.email}</td><td style={td}>{u.role}</td><td style={td}>{u.status}</td><td style={td}>{u.balance}</td>
            <td style={td}>
              <button style={btn} onClick={async () => { await post("/api/admin/users", { action: "status", userId: u.id, status: u.status === "blocked" ? "active" : "blocked" }); load(); }}>{u.status === "blocked" ? "разблок" : "блок"}</button>{" "}
              <button style={btn} onClick={async () => { const v = prompt("± кредитов"); if (v) { await post("/api/admin/users", { action: "adjust", userId: u.id, delta: Number(v), note: "admin" }); load(); } }}>± кр</button>
            </td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function Jobs() {
  const [rows, setRows] = useState<any[]>([]);
  const load = useCallback(() => { fetch("/api/admin/jobs").then((r) => r.json()).then((d) => setRows(Array.isArray(d) ? d : [])); }, []);
  useEffect(() => { load(); }, [load]);
  return (
    <div style={card}>
      <button style={btn} onClick={load}>обновить</button>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
        <thead><tr><th style={th}>промт</th><th style={th}>статус</th><th style={th}>цена</th><th style={th}>прибыль</th><th style={th}>действия</th></tr></thead>
        <tbody>{rows.map((j) => (
          <tr key={j.id}>
            <td style={{ ...td, maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{j.prompt}</td>
            <td style={td}>{j.status}</td><td style={td}>{j.priceCredits}</td><td style={td}>{j.profitCredits ?? "—"}</td>
            <td style={td}>
              {["failed", "refunded"].includes(j.status) && <button style={btn} onClick={async () => { await post("/api/admin/jobs", { action: "restart", jobId: j.id }); load(); }}>restart</button>}{" "}
              {j.status === "completed" && <button style={btn} onClick={async () => { if (confirm("Вернуть кредиты?")) { await post("/api/admin/jobs", { action: "refund", jobId: j.id }); load(); } }}>refund</button>}
            </td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function Pricing({ canEditRole }: { canEditRole: boolean }) {
  const [d, setD] = useState<any>(null);
  const load = useCallback(() => { fetch("/api/admin/pricing").then((r) => r.json()).then(setD); }, []);
  useEffect(() => { load(); }, [load]);
  if (!d) return <div style={card}>загрузка…</div>;
  return (
    <div style={card}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr><th style={th}>модель</th><th style={th}>режим</th><th style={th}>тип</th><th style={th}>значение</th><th style={th}></th></tr></thead>
        <tbody>{d.rules.map((r: any) => {
          const m = d.models.find((x: any) => x.id === r.modelId);
          return (
            <tr key={r.id}>
              <td style={td}>{m?.key ?? r.modelId}</td><td style={td}>{r.mode}</td><td style={td}>{r.priceType}</td><td style={td}>{r.value}</td>
              <td style={td}><button style={btn} onClick={async () => {
                const pt = prompt("тип: fixed|markup|multiplier", r.priceType); if (!pt) return;
                const v = prompt("значение (multiplier 200=×2)", String(r.value)); if (!v) return;
                await post("/api/admin/pricing", { modelId: r.modelId, mode: r.mode, priceType: pt, value: Number(v) }); load();
              }}>изменить</button></td>
            </tr>
          );
        })}</tbody>
      </table>
    </div>
  );
}
