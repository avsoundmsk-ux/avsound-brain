"use client";
// Ловит ошибки в корневом layout. Должен сам рендерить html/body.
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="ru">
      <body style={{ margin: 0, fontFamily: "sans-serif", background: "#0d0f14", color: "#e6e9ef" }}>
        <main style={{ maxWidth: 520, margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
          <h1>Ошибка приложения</h1>
          <button onClick={reset} style={{ marginTop: 16, padding: "10px 18px", borderRadius: 10, border: "none", background: "#ffd23f", color: "#1a1a1a", fontWeight: 700, cursor: "pointer" }}>Перезагрузить</button>
        </main>
      </body>
    </html>
  );
}
