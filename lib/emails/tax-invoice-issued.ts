function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface TaxInvoiceIssuedParams {
  businessName: string;
  supplyAmount: number;
  vatAmount: number;
  issuedDate: string;
}

export function buildTaxInvoiceIssuedHtml(params: TaxInvoiceIssuedParams): string {
  const { businessName, supplyAmount, vatAmount, issuedDate } = params;
  const total = supplyAmount + vatAmount;

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>세금계산서 발행 완료</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0"
          style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">

          <tr>
            <td style="background:#111827;padding:28px 32px;">
              <div style="font-size:13px;font-weight:700;color:#c9a84c;letter-spacing:0.08em;margin-bottom:6px;">
                3D JEWELRY TRADE
              </div>
              <div style="font-size:22px;font-weight:900;color:#ffffff;line-height:1.3;">
                세금계산서 발행이 완료되었습니다
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:28px 32px 0;">
              <p style="margin:0;font-size:15px;color:#374151;line-height:1.7;">
                안녕하세요.<br>
                요청하신 세금계산서가 <strong>${esc(businessName)}</strong> 앞으로 발행 완료되었습니다.
                홈택스 사업자 계정에서 수신 내역을 확인해 주세요.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 32px 0;">
              <div style="height:1px;background:#f3f4f6;"></div>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 32px 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;">
                    <span style="font-size:13px;color:#6b7280;font-weight:600;">공급가액</span>
                  </td>
                  <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;text-align:right;">
                    <span style="font-size:14px;color:#111827;font-weight:700;">${supplyAmount.toLocaleString("ko-KR")}원</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;">
                    <span style="font-size:13px;color:#6b7280;font-weight:600;">부가세</span>
                  </td>
                  <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;text-align:right;">
                    <span style="font-size:14px;color:#111827;font-weight:700;">${vatAmount.toLocaleString("ko-KR")}원</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;">
                    <span style="font-size:13px;color:#6b7280;font-weight:600;">합계</span>
                  </td>
                  <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;text-align:right;">
                    <span style="font-size:14px;color:#111827;font-weight:900;">${total.toLocaleString("ko-KR")}원</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;">
                    <span style="font-size:13px;color:#6b7280;font-weight:600;">발행일</span>
                  </td>
                  <td style="padding:8px 0;text-align:right;">
                    <span style="font-size:14px;color:#111827;font-weight:700;">${esc(issuedDate)}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 32px 28px;">
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.7;">
                본 메일은 3D Jewelry Trade 플랫폼에서 자동 발송된 메일입니다.<br>
                문의사항이 있으시면 고객센터를 이용해 주세요.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
