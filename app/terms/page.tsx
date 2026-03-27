export default function TermsPage() {
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
      <h1 style={{ fontSize: 30, fontWeight: 900, marginBottom: 8 }}>이용약관</h1>
      <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 40 }}>시행일: 2025년 1월 1일</p>

      <section style={sectionStyle}>
        <h2 style={h2Style}>제1조 (목적)</h2>
        <p>
          이 약관은 클래식(이하 "회사")이 운영하는 3D 주얼리 디지털 파일 거래 플랫폼(이하 "서비스")의 이용과 관련하여
          회사와 이용자 간의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>제2조 (정의)</h2>
        <ul style={ulStyle}>
          <li><strong>"서비스"</strong>란 회사가 제공하는 3D 주얼리 디지털 파일(STL, OBJ 등) 판매·구매 플랫폼을 말합니다.</li>
          <li><strong>"이용자"</strong>란 이 약관에 동의하고 서비스를 이용하는 회원 및 비회원을 말합니다.</li>
          <li><strong>"판매자"</strong>란 서비스를 통해 디지털 파일을 등록·판매하는 이용자를 말합니다.</li>
          <li><strong>"구매자"</strong>란 서비스를 통해 디지털 파일을 구매하는 이용자를 말합니다.</li>
          <li><strong>"디지털 파일"</strong>이란 3D 프린팅, CAD 등에 활용되는 주얼리 디자인 파일로, STL·OBJ·3DM 등의 형식을 포함합니다.</li>
        </ul>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>제3조 (약관의 효력 및 변경)</h2>
        <p>
          ① 이 약관은 서비스 초기 화면에 게시하거나 이용자에게 공지함으로써 효력이 발생합니다.
        </p>
        <p>
          ② 회사는 관련 법령을 위배하지 않는 범위에서 약관을 변경할 수 있으며, 변경 시 적용일 7일 전에 공지합니다.
          중요한 사항의 변경은 30일 전에 공지합니다.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>제4조 (회원가입)</h2>
        <p>
          ① 이용자는 회사가 정한 절차에 따라 회원가입 신청을 하고, 회사가 이를 승인함으로써 이용계약이 성립합니다.
        </p>
        <p>
          ② 회원은 실명 및 실제 정보를 등록해야 하며, 허위 정보 등록으로 인한 불이익은 이용자 본인이 부담합니다.
        </p>
        <p>
          ③ 1인 1계정 원칙을 준수해야 하며, 계정을 타인에게 양도·대여할 수 없습니다.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>제5조 (서비스 이용)</h2>
        <p>① 서비스는 연중무휴 24시간 제공을 원칙으로 하되, 시스템 점검·장애 등의 경우 일시 중단될 수 있습니다.</p>
        <p>② 이용자는 다음 각 호의 행위를 해서는 안 됩니다.</p>
        <ul style={ulStyle}>
          <li>타인의 계정 및 개인정보 도용</li>
          <li>서비스의 정상적인 운영을 방해하는 행위</li>
          <li>저작권 등 지적재산권을 침해하는 콘텐츠 등록</li>
          <li>음란·폭력적이거나 공서양속에 반하는 파일 등록</li>
          <li>구매한 디지털 파일을 무단으로 재배포·재판매하는 행위</li>
          <li>기타 관련 법령 및 이 약관을 위반하는 행위</li>
        </ul>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>제6조 (디지털 파일의 판매 및 구매)</h2>
        <p>① 판매자는 직접 창작한 3D 주얼리 파일만 등록할 수 있으며, 타인의 저작물을 무단 등록하는 경우 모든 법적 책임을 판매자가 집니다.</p>
        <p>② 구매자는 구매한 디지털 파일을 개인적·상업적 제작 목적으로 활용할 수 있으나, 파일 자체를 제3자에게 재판매하거나 배포할 수 없습니다.</p>
        <p>③ 회사는 거래 중개자로서 판매자와 구매자 간 거래에서 발생하는 분쟁에 직접적인 책임을 지지 않습니다.</p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>제7조 (수수료)</h2>
        <p>회사는 판매자의 수익에 대해 별도 공지하는 수수료율에 따라 플랫폼 이용료를 부과할 수 있습니다.
        수수료 변경 시 30일 전에 사전 공지합니다.</p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>제8조 (개인정보 보호)</h2>
        <p>회사는 관련 법령 및 별도의 개인정보처리방침에 따라 이용자의 개인정보를 보호합니다.</p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>제9조 (책임의 제한)</h2>
        <p>① 회사는 천재지변, 전쟁, 서비스 장애 등 불가항력으로 인한 서비스 중단에 대해 책임을 지지 않습니다.</p>
        <p>② 회사는 이용자가 게시한 디지털 파일의 내용, 품질, 저작권 등에 대한 책임을 지지 않습니다.</p>
        <p>③ 이용자의 귀책사유로 인한 손해에 대해서는 회사가 책임을 지지 않습니다.</p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>제10조 (관할법원 및 준거법)</h2>
        <p>
          이 약관은 대한민국 법률에 따라 해석되며, 서비스 이용으로 인한 분쟁이 발생하는 경우
          회사의 본사 소재지를 관할하는 법원을 전속 관할 법원으로 합니다.
        </p>
      </section>

      <p style={{ marginTop: 48, color: "#9ca3af", fontSize: 13 }}>
        사업자: 클래식 | 대표자: 정승재 | 사업자등록번호: 556-27-01208<br />
        주소: 서울특별시 중구 다산로33라길 15-4, 1층
      </p>
    </main>
  );
}

const sectionStyle: React.CSSProperties = {
  marginBottom: 36,
};

const h2Style: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  marginBottom: 10,
  color: "#111827",
};

const ulStyle: React.CSSProperties = {
  paddingLeft: 20,
  margin: "8px 0",
  color: "#374151",
};
