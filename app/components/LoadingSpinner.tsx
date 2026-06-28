export function LoadingSpinner({ message, fullPage }: { message?: string; fullPage?: boolean }) {
  if (fullPage) {
    return (
      <main style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", fontFamily: "system-ui, -apple-system, sans-serif", flexDirection: "column", gap: 16, color: "#6b7280" }}>
        <div style={{ width: 40, height: 40, border: "3px solid #e5e7eb", borderTopColor: "#111827", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ fontSize: 15, fontWeight: 600 }}>{message ?? "불러오는 중..."}</p>
      </main>
    );
  }
  return (
    <div style={{ padding: "48px 0", textAlign: "center", color: "#9ca3af" }}>
      {message ?? "불러오는 중..."}
    </div>
  );
}
