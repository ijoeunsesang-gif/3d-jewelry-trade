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
        <h2 style={h2Style}>제10조 (플랫폼 중개자 지위)</h2>
        <p>
          ① 회사(3D 마켓)는 전자상거래 등에서의 소비자보호에 관한 법률에 따른 통신판매중개자로서,
          판매자가 등록한 상품 및 디지털 파일에 대한 직접적인 판매 책임을 지지 않습니다.
        </p>
        <p>
          ② 단, 회사가 판매자의 지식재산권 침해 신고를 인지하고도 합리적인 조치 없이 방치한 경우에는
          관련 법령에 따라 책임이 발생할 수 있습니다.
        </p>
        <p>
          ③ 회사는 이용자 보호를 위해 신고·분쟁 처리 절차를 운영하며, 이를 성실히 이행합니다.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>제11조 (판매자 지식재산권 보증)</h2>
        <p>
          ① 판매자는 서비스에 등록하는 모든 상품 및 디지털 파일이 다음 각 호의 제3자 권리를 침해하지 않음을
          보증합니다.
        </p>
        <ul style={ulStyle}>
          <li>상표권</li>
          <li>디자인권</li>
          <li>저작권</li>
          <li>특허권</li>
          <li>초상권 및 퍼블리시티권</li>
          <li>기타 지식재산권 및 법적 권리</li>
        </ul>
        <p>
          ② 판매자는 본인이 해당 파일의 정당한 권리자이거나 권리자로부터 적법한 이용 허락을 받았음을 확인합니다.
        </p>
        <p>
          ③ 위 보증에 위반하여 발생하는 모든 분쟁 및 손해에 대한 책임은 해당 판매자에게 있으며,
          회사는 이로 인한 책임을 지지 않습니다.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>제12조 (면책 및 손해배상)</h2>
        <p>
          ① 판매자는 자신이 등록한 상품·콘텐츠로 인해 발생하는 다음 각 호의 모든 사항에 대해 단독으로 책임을 집니다.
        </p>
        <ul style={ulStyle}>
          <li>제3자와의 분쟁 및 소송</li>
          <li>제3자에 대한 손해배상</li>
          <li>회사 또는 제3자가 부담한 변호사 비용 및 소송 비용</li>
          <li>행정기관의 제재 또는 과태료</li>
        </ul>
        <p>
          ② 판매자가 등록한 콘텐츠로 인해 제3자가 회사에 클레임, 소송, 손해배상을 청구하는 경우,
          회사는 해당 판매자에게 구상권을 행사할 수 있습니다.
        </p>
        <p>
          ③ 회사는 판매자가 등록한 콘텐츠의 적법성·정확성·품질에 대해 보증하지 않으며,
          이로 인한 제3자 클레임에 대해 면책됩니다.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>제13조 (신고 및 즉시 삭제 정책)</h2>
        <p>
          ① 이용자 또는 제3자는 서비스 내 콘텐츠가 저작권·상표권 등 지식재산권을 침해한다고 판단하는 경우
          회사에 신고할 수 있습니다.
        </p>
        <p>
          ② 회사는 침해 신고를 접수한 즉시 해당 콘텐츠를 블라인드(비공개) 처리하여 추가 피해를 방지합니다.
        </p>
        <p>
          ③ 회사는 신고 접수 후 조사를 진행하며, 침해 사실이 확인된 경우 다음의 조치를 취합니다.
        </p>
        <ul style={ulStyle}>
          <li>해당 콘텐츠 영구 삭제</li>
          <li>판매자에 대한 제재 (경고, 판매 정지, 계정 제한 등)</li>
          <li>신고자에게 조치 결과 통보</li>
        </ul>
        <p>
          ④ 허위 신고 또는 악의적 신고로 확인된 경우, 신고자에 대해 서비스 이용 제한 등의 조치를 취할 수 있습니다.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>제14조 (반복 침해자 제재)</h2>
        <p>
          ① 동일 판매자가 지식재산권 침해 상품을 반복적으로 등록하는 경우, 회사는 다음의 단계별 제재를 적용합니다.
        </p>
        <ul style={ulStyle}>
          <li><strong>1차 위반:</strong> 경고 및 해당 상품 삭제</li>
          <li><strong>2차 위반:</strong> 30일 이상 판매 정지 및 미정산 판매금 보류</li>
          <li><strong>3차 위반 또는 중대한 침해:</strong> 계정 영구 정지 및 플랫폼 영구 차단</li>
        </ul>
        <p>
          ② 계정 영구 정지된 판매자의 미정산 판매금은 관련 법령 및 피해자 보상 절차에 따라 처리되며,
          정산이 보류될 수 있습니다.
        </p>
        <p>
          ③ 영구 차단된 판매자는 새로운 계정을 생성하여 서비스를 이용할 수 없습니다.
          이를 위반한 경우 법적 조치를 취할 수 있습니다.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>제15조 (관할법원 및 준거법)</h2>
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
