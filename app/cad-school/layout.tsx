import { ReactNode } from "react";

const IS_MAINTENANCE = false;

export default function CadSchoolLayout({ children }: { children: ReactNode }) {
  if (IS_MAINTENANCE) {
    return (
      <main style={{ maxWidth: 600, margin: "120px auto", padding: "0 20px", textAlign: "center", fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🎓</div>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: "#111827", marginBottom: 12 }}>캐드스쿨 준비중</h1>
        <p style={{ fontSize: 15, color: "#6b7280", lineHeight: 1.7 }}>
          더 나은 서비스를 위해 준비중입니다.<br />
          곧 오픈할 예정이니 조금만 기다려주세요!
        </p>
      </main>
    );
  }
  return <>{children}</>;
}
