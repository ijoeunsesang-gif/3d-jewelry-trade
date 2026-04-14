import Link from "next/link";

export default function Footer() {
  return (
    <footer
      style={{
        marginTop: 80,
        borderTop: "1px solid #e5e7eb",
        background: "#fff",
        padding: "40px 24px 32px",
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* 정책 링크 */}
        <div
          style={{
            display: "flex",
            gap: 20,
            marginBottom: 24,
            flexWrap: "wrap",
          }}
        >
          <Link
            href="/terms"
            style={{ fontSize: 13, fontWeight: 700, color: "#374151", textDecoration: "none" }}
          >
            이용약관
          </Link>
          <Link
            href="/privacy"
            style={{ fontSize: 13, fontWeight: 700, color: "#374151", textDecoration: "none" }}
          >
            개인정보처리방침
          </Link>
          <Link
            href="/refund"
            style={{ fontSize: 13, fontWeight: 700, color: "#374151", textDecoration: "none" }}
          >
            환불정책
          </Link>
        </div>

        {/* 사업자 정보 */}
        <div
          style={{
            fontSize: 12,
            color: "#9ca3af",
            lineHeight: 1.9,
          }}
        >
          <p style={{ margin: 0 }}>
            상호명: 클래식&nbsp;&nbsp;|&nbsp;&nbsp;대표자: 정승재&nbsp;&nbsp;|&nbsp;&nbsp;사업자등록번호: 556-27-01208
          </p>
          <p style={{ margin: 0 }}>
            주소: 서울특별시 중구 다산로33라길 15-4, 1층
          </p>
          <p style={{ margin: 0 }}>
            고객센터: 070-7954-3257
          </p>
          <p style={{ margin: "6px 0 0" }}>
            © {new Date().getFullYear()} 클래식. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
