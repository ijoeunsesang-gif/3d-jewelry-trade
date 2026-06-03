/** HTML 특수문자 이스케이프 (XSS 방지) */
function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** 줄바꿈을 <br>로 변환 (pre-wrap 대신 이메일 클라이언트 호환) */
function nl2br(str: string): string {
  return esc(str).replace(/\n/g, "<br>");
}

export interface InquiryReplyEmailParams {
  customerName: string;
  inquiryTitle: string;
  inquiryContent: string;
  adminAnswer: string;
  answeredAt: Date;
}

export function buildInquiryReplyHtml(params: InquiryReplyEmailParams): string {
  const { customerName, inquiryTitle, inquiryContent, adminAnswer, answeredAt } = params;

  const name = customerName.trim() || "고객";
  const dateStr = answeredAt.toLocaleString("ko-KR", {
    year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>문의 답변 안내</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">

  <!-- 바깥 래퍼 -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">

        <!-- 카드 -->
        <table width="100%" cellpadding="0" cellspacing="0"
          style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;
                 box-shadow:0 4px 24px rgba(0,0,0,0.07);">

          <!-- 헤더 배너 -->
          <tr>
            <td style="background:#111827;padding:28px 32px;">
              <div style="font-size:13px;font-weight:700;color:#c9a84c;letter-spacing:0.08em;margin-bottom:6px;">
                3D JEWELRY TRADE
              </div>
              <div style="font-size:22px;font-weight:900;color:#ffffff;line-height:1.3;">
                문의 답변이 등록되었습니다
              </div>
            </td>
          </tr>

          <!-- 인사말 -->
          <tr>
            <td style="padding:28px 32px 0;">
              <p style="margin:0;font-size:15px;color:#374151;line-height:1.7;">
                안녕하세요, <strong>${esc(name)}</strong>님.<br>
                문의하신 내용에 답변이 등록되었습니다.
              </p>
            </td>
          </tr>

          <!-- 구분선 -->
          <tr>
            <td style="padding:20px 32px 0;">
              <div style="height:1px;background:#f3f4f6;"></div>
            </td>
          </tr>

          <!-- 문의 제목 -->
          <tr>
            <td style="padding:20px 32px 0;">
              <div style="font-size:11px;font-weight:800;color:#9ca3af;letter-spacing:0.06em;
                          text-transform:uppercase;margin-bottom:8px;">문의 제목</div>
              <div style="font-size:15px;font-weight:700;color:#111827;">
                ${esc(inquiryTitle)}
              </div>
            </td>
          </tr>

          <!-- 원래 문의 내용 -->
          <tr>
            <td style="padding:16px 32px 0;">
              <div style="font-size:11px;font-weight:800;color:#9ca3af;letter-spacing:0.06em;
                          text-transform:uppercase;margin-bottom:8px;">문의 내용</div>
              <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;
                          padding:16px;font-size:14px;color:#374151;line-height:1.75;">
                ${nl2br(inquiryContent)}
              </div>
            </td>
          </tr>

          <!-- 관리자 답변 -->
          <tr>
            <td style="padding:16px 32px 0;">
              <div style="font-size:11px;font-weight:800;color:#15803d;letter-spacing:0.06em;
                          text-transform:uppercase;margin-bottom:8px;">관리자 답변</div>
              <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;
                          padding:16px;font-size:14px;color:#111827;line-height:1.75;">
                ${nl2br(adminAnswer)}
              </div>
            </td>
          </tr>

          <!-- 답변 일시 -->
          <tr>
            <td style="padding:12px 32px 0;">
              <div style="font-size:12px;color:#9ca3af;">
                답변 일시: ${dateStr}
              </div>
            </td>
          </tr>

          <!-- 구분선 -->
          <tr>
            <td style="padding:24px 32px 0;">
              <div style="height:1px;background:#f3f4f6;"></div>
            </td>
          </tr>

          <!-- 푸터 -->
          <tr>
            <td style="padding:20px 32px 28px;">
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.7;">
                본 메일은 3D Jewelry Trade 플랫폼에서 자동 발송된 메일입니다.<br>
                추가 문의사항이 있으시면 고객센터를 이용해 주세요.
              </p>
            </td>
          </tr>

        </table>
        <!-- /카드 -->

      </td>
    </tr>
  </table>

</body>
</html>`;
}
