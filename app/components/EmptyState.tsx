export function EmptyState({
  message,
  icon,
  title,
  desc,
}: {
  message?: string;
  icon?: string;
  title?: string;
  desc?: string;
}) {
  if (icon && title) {
    return (
      <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 18, padding: "60px 20px", textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 14 }}>{icon}</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#111827", marginBottom: 6 }}>{title}</div>
        {desc && <div style={{ fontSize: 13, color: "#9ca3af" }}>{desc}</div>}
      </div>
    );
  }
  return (
    <p style={{ textAlign: "center", color: "#9ca3af", padding: "48px 0", fontSize: 15 }}>
      {message}
    </p>
  );
}
