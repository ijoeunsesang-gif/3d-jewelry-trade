// 실제 상세페이지 레이아웃(.detail-grid: 이미지 영역 4 : 사이드바 1.5 비율)과
// 최대한 같은 형태로 맞춰서, 서버 데이터가 도착해 실제 콘텐츠로 바뀔 때
// 스켈레톤 → 콘텐츠 전환이 툭 튀지 않고 자연스럽게 이어지게 한다.
const bar = (extra?: React.CSSProperties): React.CSSProperties => ({
  background: "#e5e7eb",
  borderRadius: 8,
  animation: "skeleton-pulse 1.5s ease-in-out infinite",
  ...extra,
});

export default function Loading() {
  return (
    <main className="detail-main">
      {/* 뒤로가기 + 브레드크럼 */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
        <div style={bar({ width: 84, height: 32, borderRadius: 10 })} />
        <div style={bar({ width: 160, height: 16 })} />
      </div>

      <div className="detail-grid">
        {/* 좌측: 이미지 뷰어 + 갤러리 */}
        <section>
          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            <div style={bar({ width: 120, height: 52, borderRadius: 999 })} />
            <div style={bar({ width: 100, height: 52, borderRadius: 999 })} />
          </div>

          <div className="detail-viewer-box" style={bar({ border: "1px solid #e5e7eb" })} />

          <div
            style={{
              marginTop: 14,
              display: "grid",
              gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
              gap: 10,
            }}
          >
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={bar({ aspectRatio: "1 / 1", borderRadius: 16 })} />
            ))}
          </div>
        </section>

        {/* 우측: 사이드바(제목/가격/버튼) */}
        <aside
          className="detail-aside"
          style={{ border: "1px solid #e5e7eb", borderRadius: 28, background: "white", padding: 28 }}
        >
          <div style={bar({ width: 90, height: 30, borderRadius: 999, marginBottom: 16 })} />
          <div style={bar({ width: "85%", height: 22, marginBottom: 10 })} />
          <div style={bar({ width: "55%", height: 14, marginBottom: 18 })} />

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <div style={bar({ width: 38, height: 38, borderRadius: "50%" })} />
            <div style={bar({ width: 110, height: 14 })} />
          </div>

          <div style={bar({ width: "100%", height: 13, marginBottom: 8 })} />
          <div style={bar({ width: "92%", height: 13, marginBottom: 8 })} />
          <div style={bar({ width: "68%", height: 13, marginBottom: 22 })} />

          <div style={bar({ width: "45%", height: 26, marginLeft: "auto", marginBottom: 18 })} />

          <div style={{ display: "grid", gap: 12 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={bar({ height: 52, borderRadius: 16 })} />
            ))}
          </div>
        </aside>
      </div>
    </main>
  );
}
