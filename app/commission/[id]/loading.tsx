export default function Loading() {
  return (
    <div style={{ maxWidth: 860, margin: "48px auto", padding: "0 24px" }}>
      <div style={{ height: 28, background: "#f3f4f6", borderRadius: 8, marginBottom: 16, width: "55%" }} />
      <div style={{ height: 140, background: "#f3f4f6", borderRadius: 12, marginBottom: 20 }} />
      <div style={{ height: 80, background: "#f3f4f6", borderRadius: 12, marginBottom: 20 }} />
      <div style={{ height: 80, background: "#f3f4f6", borderRadius: 12 }} />
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} } div{animation:pulse 1.5s ease-in-out infinite}`}</style>
    </div>
  );
}
