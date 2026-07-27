function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface TaxInvoiceRequestedParams {
  businessName: string;
  businessNumber: string;
  ceoName: string;
  businessAddress: string;
  email: string;
  supplyAmount: number;
  vatAmount: number;
  managePageUrl: string;
}

export function buildTaxInvoiceRequestedHtml(params: TaxInvoiceRequestedParams): string {
  const { businessName, businessNumber, ceoName, businessAddress, email, supplyAmount, vatAmount, managePageUrl } = params;
  const total = supplyAmount + vatAmount;

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>세금계산서 발행 요청</title>
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
                세금계산서 발행 요청이 접수되었습니다
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:28px 32px 0;">
              <p style="margin:0;font-size:15px;color:#374151;line-height:1.7;">
                구매자가 세금계산서 발행을 요청했습니다.<br>
                아래 사업자 정보로 홈택스에서 세금계산서를 발행한 뒤, 판매자 페이지에서 "발행 완료" 처리를 해주세요.
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
              <div style="font-size:11px;font-weight:800;color:#9ca3af;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:12px;">
                구매자 사업자 정보
              </div>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${[
                  ["상호명", businessName],
                  ["사업자등록번호", businessNumber],
                  ["대표자", ceoName],
                  ["사업장 주소", businessAddress],
                  ["이메일", email],
                ].map(([label, value]) => `
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;">
                    <span style="font-size:13px;color:#6b7280;font-weight:600;">${esc(label)}</span>
                  </td>
                  <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;text-align:right;">
                    <span style="font-size:14px;color:#111827;font-weight:800;">${esc(value)}</span>
                  </td>
                </tr>`).join("")}
                <tr>
                  <td style="padding:8px 0;">
                    <span style="font-size:13px;color:#6b7280;font-weight:600;">공급가액 + 부가세</span>
                  </td>
                  <td style="padding:8px 0;text-align:right;">
                    <span style="font-size:14px;color:#111827;font-weight:800;">
                      ${supplyAmount.toLocaleString("ko-KR")}원 + ${vatAmount.toLocaleString("ko-KR")}원 = ${total.toLocaleString("ko-KR")}원
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 32px 0;">
              <div style="height:1px;background:#f3f4f6;"></div>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 32px 0;">
              <a href="${esc(managePageUrl)}"
                style="display:block;text-align:center;background:#111827;color:#ffffff;text-decoration:none;
                       font-weight:800;font-size:15px;padding:14px 24px;border-radius:12px;">
                요청 목록에서 확인하기
              </a>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 32px 28px;">
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.7;">
                본 메일은 3D Jewelry Trade 플랫폼에서 자동 발송된 메일입니다.<br>
                세금계산서 발행은 판매자가 홈택스 등 외부에서 직접 진행합니다.
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
