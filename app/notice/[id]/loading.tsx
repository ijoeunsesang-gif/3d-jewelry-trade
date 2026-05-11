export default function Loading() {
  return (
    <div style={{ maxWidth: 760, margin: "48px auto", padding: "0 20px" }}>
      <div style={{ height: 32, background: "#f3f4f6", borderRadius: 8, marginBottom: 12, width: "70%" }} />
      <div style={{ height: 16, background: "#f3f4f6", borderRadius: 8, marginBottom: 32, width: "25%" }} />
      <div style={{ height: 200, background: "#f3f4f6", borderRadius: 8 }} />
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} } div{animation:pulse 1.5s ease-in-out infinite}`}</style>
    </div>
  );
}
