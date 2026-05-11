export default function Loading() {
  return (
    <div style={{ maxWidth: 900, margin: "48px auto", padding: "0 24px" }}>
      <div style={{ display: "flex", gap: 20, marginBottom: 32 }}>
        <div style={{ width: 80, height: 80, borderRadius: "50%", background: "#f3f4f6", flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ height: 28, background: "#f3f4f6", borderRadius: 8, marginBottom: 10, width: "50%" }} />
          <div style={{ height: 18, background: "#f3f4f6", borderRadius: 8, width: "30%" }} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ height: 200, background: "#f3f4f6", borderRadius: 12 }} />
        ))}
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} } div{animation:pulse 1.5s ease-in-out infinite}`}</style>
    </div>
  );
}
