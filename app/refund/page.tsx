export default function RefundPage() {
  return (
    <main
      style={{
        maxWidth: 860,
        margin: "48px auto",
        padding: "0 24px 80px",
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        color: "#111827",
        lineHeight: 1.8,
      }}
    >
      <h1 style={{ fontSize: 30, fontWeight: 900, marginBottom: 8 }}>환불정책</h1>
      <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 40 }}>시행일: 2025년 1월 1일</p>

      {/* 요약 박스 */}
      <div
        style={{
          background: "#fffbeb",
          border: "1px solid #fcd34d",
          borderRadius: 16,
          padding: "18px 22px",
          marginBottom: 40,
          fontSize: 14,
          color: "#92400e",
          lineHeight: 1.7,
        }}
      >
        <strong>중요 안내:</strong> 본 서비스는 디지털 파일(3D 모델링 데이터)을 판매합니다.
        디지털 콘텐츠 특성상 파일을 다운로드한 이후에는 단순 변심에 의한 환불이 원칙적으로 불가합니다.
        구매 전 상품 정보를 꼼꼼히 확인해 주시기 바랍니다.
      </div>

      <section style={sectionStyle}>
        <h2 style={h2Style}>제1조 (적용 범위)</h2>
        <p>
          이 환불정책은 클래식(이하 "회사")이 운영하는 3D 주얼리 디지털 파일 거래 플랫폼에서
          구매한 모든 디지털 파일에 적용됩니다.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>제2조 (환불 불가 원칙)</h2>
        <p>
          디지털 콘텐츠의 특성상 아래 경우에 해당하면 환불이 불가합니다.
        </p>
        <ul style={ulStyle}>
          <li>구매 후 파일을 1회 이상 다운로드한 경우</li>
          <li>단순 변심 또는 구매 실수의 경우</li>
          <li>구매자의 환경(소프트웨어, 3D 프린터 사양 등)이 맞지 않아 활용이 어려운 경우</li>
          <li>파일 형식·용량 등 상품 페이지에 명시된 정보를 확인하지 않고 구매한 경우</li>
        </ul>
        <p style={{ marginTop: 10, color: "#6b7280", fontSize: 14 }}>
          ※ 전자상거래법 제17조 제2항 제5호에 따라 디지털 콘텐츠의 경우 재화 등의 제공이 개시된 경우 청약철회권이 제한됩니다.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>제3조 (환불 가능 사유)</h2>
        <p>다음 사유에 해당하는 경우 구매일로부터 <strong>7일 이내</strong>에 환불을 신청할 수 있습니다.</p>

        <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
          {[
            {
              title: "파일 불량 또는 손상",
              desc: "다운로드한 파일이 열리지 않거나, 파일 내용이 상품 설명과 현저히 다른 경우",
            },
            {
              title: "이중 결제",
              desc: "시스템 오류로 동일 상품이 중복 결제된 경우",
            },
            {
              title: "미다운로드 상태의 단순 변심",
              desc: "파일을 한 번도 다운로드하지 않았고, 결제 후 7일 이내인 경우 1회에 한해 환불 가능",
            },
          ].map((item) => (
            <div
              key={item.title}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 14,
                padding: "14px 18px",
                background: "white",
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: 4 }}>✓ {item.title}</div>
              <div style={{ fontSize: 14, color: "#6b7280" }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>제4조 (환불 신청 방법)</h2>
        <p>환불을 원하시는 경우 아래 방법으로 신청해 주세요.</p>
        <div
          style={{
            background: "#f9fafb",
            border: "1px solid #e5e7eb",
            borderRadius: 14,
            padding: "16px 20px",
            marginTop: 10,
          }}
        >
          <p style={{ margin: 0 }}>① 서비스 내 "문의함" 메뉴에서 환불 요청</p>
          <p style={{ margin: 0 }}>② 신청 시 포함 사항: 주문 번호, 구매 상품명, 환불 사유</p>
          <p style={{ margin: 0 }}>③ 처리 기간: 접수 후 영업일 기준 3~5일 이내</p>
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>제5조 (환불 처리)</h2>
        <p>
          환불이 확인된 경우 결제 수단에 따라 아래 기간 내에 환불 처리됩니다.
        </p>
        <table style={tableStyle}>
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              <th style={thStyle}>결제 수단</th>
              <th style={thStyle}>환불 처리 기간</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdStyle}>신용카드 / 체크카드</td>
              <td style={tdStyle}>영업일 기준 3~5일 (카드사 정책에 따라 상이)</td>
            </tr>
            <tr>
              <td style={tdStyle}>계좌이체</td>
              <td style={tdStyle}>영업일 기준 1~3일</td>
            </tr>
            <tr>
              <td style={tdStyle}>카카오페이 / 네이버페이 / 토스페이</td>
              <td style={tdStyle}>영업일 기준 1~3일</td>
            </tr>
            <tr>
              <td style={tdStyle}>삼성페이</td>
              <td style={tdStyle}>영업일 기준 3~5일</td>
            </tr>
          </tbody>
        </table>
        <p style={{ marginTop: 10, fontSize: 14, color: "#6b7280" }}>
          ※ 환불 처리 시 이미 발급된 다운로드 권한은 즉시 회수됩니다.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>제6조 (판매자와의 분쟁)</h2>
        <p>
          구매한 파일의 저작권 침해, 파일 내용 허위 기재 등 판매자 귀책 사유로 발생한 분쟁은
          회사가 중재에 협조하며, 필요시 해당 판매자의 계정을 정지하고 구매자에게 환불을 지원합니다.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>제7조 (소비자 피해 구제)</h2>
        <p>
          본 정책으로 해결되지 않는 분쟁은 아래 기관에 도움을 요청하실 수 있습니다.
        </p>
        <ul style={ulStyle}>
          <li>한국소비자원: 1372 / <a href="https://www.kca.go.kr" target="_blank" rel="noreferrer" style={{ color: "#c9a84c" }}>www.kca.go.kr</a></li>
          <li>전자거래분쟁조정위원회: 1661-5714 / <a href="https://www.ecmc.or.kr" target="_blank" rel="noreferrer" style={{ color: "#c9a84c" }}>www.ecmc.or.kr</a></li>
          <li>공정거래위원회: 1372 / <a href="https://www.ftc.go.kr" target="_blank" rel="noreferrer" style={{ color: "#c9a84c" }}>www.ftc.go.kr</a></li>
        </ul>
      </section>

      <p style={{ marginTop: 48, color: "#9ca3af", fontSize: 13 }}>
        사업자: 클래식 | 대표자: 정승재 | 사업자등록번호: 556-27-01208<br />
        주소: 서울특별시 중구 다산로33라길 15-4, 1층
      </p>
    </main>
  );
}

const sectionStyle: React.CSSProperties = { marginBottom: 36 };
const h2Style: React.CSSProperties = { fontSize: 18, fontWeight: 900, marginBottom: 10, color: "#111827" };
const ulStyle: React.CSSProperties = { paddingLeft: 20, margin: "8px 0", color: "#374151" };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 14 };
const thStyle: React.CSSProperties = { padding: "10px 14px", border: "1px solid #e5e7eb", fontWeight: 800, textAlign: "left" };
const tdStyle: React.CSSProperties = { padding: "10px 14px", border: "1px solid #e5e7eb", color: "#374151" };
