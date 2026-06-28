export default function Loading() {
  return (
    <main style={{ maxWidth: 520, margin: "0 auto", padding: "80px 24px", textAlign: "center", color: "#8b93a3" }}>
      <div style={{ width: 28, height: 28, margin: "0 auto 12px", border: "3px solid #2a313d", borderTopColor: "#ffd23f", borderRadius: "50%", animation: "spin .7s linear infinite" }} />
      Загрузка…
      <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
    </main>
  );
}
