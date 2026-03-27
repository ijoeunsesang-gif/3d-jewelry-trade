export default function PrivacyPage() {
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
      <h1 style={{ fontSize: 30, fontWeight: 900, marginBottom: 8 }}>개인정보처리방침</h1>
      <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 40 }}>시행일: 2025년 1월 1일</p>

      <p style={{ marginBottom: 32, color: "#374151" }}>
        클래식(이하 "회사")은 개인정보보호법, 정보통신망 이용촉진 및 정보보호 등에 관한 법률 등 관련 법령에 따라
        이용자의 개인정보를 보호하고 이와 관련한 고충을 신속하고 원활하게 처리할 수 있도록
        다음과 같이 개인정보처리방침을 수립·공개합니다.
      </p>

      <section style={sectionStyle}>
        <h2 style={h2Style}>제1조 (수집하는 개인정보 항목 및 수집 방법)</h2>
        <p>회사는 서비스 제공을 위해 다음과 같은 개인정보를 수집합니다.</p>
        <table style={tableStyle}>
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              <th style={thStyle}>구분</th>
              <th style={thStyle}>수집 항목</th>
              <th style={thStyle}>수집 목적</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdStyle}>회원가입</td>
              <td style={tdStyle}>이메일 주소, 비밀번호</td>
              <td style={tdStyle}>본인 확인, 서비스 제공</td>
            </tr>
            <tr>
              <td style={tdStyle}>결제</td>
              <td style={tdStyle}>이름, 이메일, 결제 수단 정보</td>
              <td style={tdStyle}>결제 처리 및 환불</td>
            </tr>
            <tr>
              <td style={tdStyle}>서비스 이용</td>
              <td style={tdStyle}>IP 주소, 접속 기기 정보, 쿠키</td>
              <td style={tdStyle}>서비스 개선, 보안</td>
            </tr>
          </tbody>
        </table>
        <p style={{ marginTop: 10 }}>수집 방법: 회원가입 및 서비스 이용 시 이용자 직접 입력, 자동 수집</p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>제2조 (개인정보의 이용 목적)</h2>
        <ul style={ulStyle}>
          <li>회원 가입·관리 및 본인 확인</li>
          <li>서비스 제공 및 콘텐츠 구매·다운로드 처리</li>
          <li>결제 처리 및 구매 내역 관리</li>
          <li>고객 문의 응대 및 분쟁 처리</li>
          <li>서비스 개선을 위한 통계 분석</li>
          <li>법령상 의무 이행</li>
        </ul>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>제3조 (개인정보의 보유 및 이용 기간)</h2>
        <p>회사는 개인정보 수집·이용 목적이 달성된 후에는 지체 없이 파기합니다. 단, 관계 법령에 따라 보존해야 하는 경우에는 해당 기간 동안 보관합니다.</p>
        <table style={tableStyle}>
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              <th style={thStyle}>보관 항목</th>
              <th style={thStyle}>보존 기간</th>
              <th style={thStyle}>근거 법령</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdStyle}>계약 또는 청약철회에 관한 기록</td>
              <td style={tdStyle}>5년</td>
              <td style={tdStyle}>전자상거래법</td>
            </tr>
            <tr>
              <td style={tdStyle}>대금 결제 및 재화 공급에 관한 기록</td>
              <td style={tdStyle}>5년</td>
              <td style={tdStyle}>전자상거래법</td>
            </tr>
            <tr>
              <td style={tdStyle}>소비자 불만 및 분쟁 처리 기록</td>
              <td style={tdStyle}>3년</td>
              <td style={tdStyle}>전자상거래법</td>
            </tr>
            <tr>
              <td style={tdStyle}>접속 로그</td>
              <td style={tdStyle}>3개월</td>
              <td style={tdStyle}>통신비밀보호법</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>제4조 (개인정보의 제3자 제공)</h2>
        <p>
          회사는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 다만, 다음의 경우에는 예외로 합니다.
        </p>
        <ul style={ulStyle}>
          <li>이용자가 사전에 동의한 경우</li>
          <li>법령의 규정에 의거하거나, 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관이 요구하는 경우</li>
        </ul>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>제5조 (개인정보 처리 위탁)</h2>
        <p>회사는 서비스 향상을 위해 아래와 같이 개인정보 처리 업무를 위탁하고 있습니다.</p>
        <table style={tableStyle}>
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              <th style={thStyle}>수탁 업체</th>
              <th style={thStyle}>위탁 업무</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdStyle}>포트원(PortOne)</td>
              <td style={tdStyle}>결제 처리</td>
            </tr>
            <tr>
              <td style={tdStyle}>Supabase Inc.</td>
              <td style={tdStyle}>데이터베이스 및 인증 서비스</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>제6조 (이용자의 권리)</h2>
        <p>이용자는 언제든지 다음 권리를 행사할 수 있습니다.</p>
        <ul style={ulStyle}>
          <li>개인정보 열람 요청</li>
          <li>개인정보 오류 정정 요청</li>
          <li>개인정보 삭제 요청</li>
          <li>개인정보 처리 정지 요청</li>
        </ul>
        <p>위 권리 행사는 서비스 내 설정 또는 고객센터를 통해 요청할 수 있으며, 회사는 지체 없이 처리합니다.</p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>제7조 (쿠키의 운용)</h2>
        <p>
          회사는 이용자에게 개인화된 서비스를 제공하기 위해 쿠키(cookie)를 사용합니다.
          이용자는 브라우저 설정을 통해 쿠키 저장을 거부할 수 있으나, 일부 서비스 이용에 제한이 생길 수 있습니다.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>제8조 (개인정보의 파기)</h2>
        <p>
          회사는 개인정보 보유 기간이 경과하거나 처리 목적이 달성된 경우 개인정보를 파기합니다.
          전자적 파일은 복구 불가능한 방법으로 삭제하며, 서면은 분쇄 또는 소각합니다.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>제9조 (개인정보 보호책임자)</h2>
        <p>
          회사는 개인정보 처리에 관한 업무를 총괄하고, 관련 민원을 처리하기 위해 아래와 같이 개인정보 보호책임자를 지정합니다.
        </p>
        <div
          style={{
            background: "#f9fafb",
            border: "1px solid #e5e7eb",
            borderRadius: 14,
            padding: "16px 20px",
            marginTop: 10,
          }}
        >
          <p style={{ margin: 0 }}>개인정보 보호책임자: 정승재</p>
          <p style={{ margin: 0 }}>사업자: 클래식</p>
          <p style={{ margin: 0 }}>주소: 서울특별시 중구 다산로33라길 15-4, 1층</p>
        </div>
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
