"use client";
// Глобальный error boundary (App Router). Без утечки деталей наружу.
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main style={{ maxWidth: 520, margin: "0 auto", padding: "80px 24px", textAlign: "center", color: "#e6e9ef" }}>
      <h1 style={{ fontSize: 28 }}>Что-то пошло не так</h1>
      <p style={{ color: "#8b93a3" }}>Произошла ошибка. Попробуйте ещё раз.</p>
      <button onClick={reset} style={{ marginTop: 16, padding: "10px 18px", borderRadius: 10, border: "none", background: "#ffd23f", color: "#1a1a1a", fontWeight: 700, cursor: "pointer" }}>
        Повторить
      </button>
    </main>
  );
}
