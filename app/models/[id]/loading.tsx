export default function Loading() {
  return (
    <div style={{ maxWidth: 1100, margin: "48px auto", padding: "0 24px" }}>
      <div style={{ height: 400, background: "#f3f4f6", borderRadius: 16, marginBottom: 24, animation: "pulse 1.5s ease-in-out infinite" }} />
      <div style={{ height: 32, background: "#f3f4f6", borderRadius: 8, marginBottom: 12, width: "60%" }} />
      <div style={{ height: 20, background: "#f3f4f6", borderRadius: 8, width: "40%", marginBottom: 24 }} />
      <div style={{ height: 80, background: "#f3f4f6", borderRadius: 8 }} />
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }`}</style>
    </div>
  );
}
