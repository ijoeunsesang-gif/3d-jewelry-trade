import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { paymentId, expectedAmount } = await req.json();

    if (!paymentId || typeof expectedAmount !== "number") {
      return NextResponse.json(
        { success: false, message: "잘못된 요청입니다." },
        { status: 400 }
      );
    }

    const apiSecret = process.env.PORTONE_API_SECRET;
    if (!apiSecret) {
      return NextResponse.json(
        { success: false, message: "서버 설정 오류입니다." },
        { status: 500 }
      );
    }

    const response = await fetch(
      `https://api.portone.io/payments/${encodeURIComponent(paymentId)}`,
      {
        headers: {
          Authorization: `PortOne ${apiSecret}`,
        },
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error("PortOne API 오류:", err);
      return NextResponse.json(
        { success: false, message: "결제 정보 조회에 실패했습니다." },
        { status: 502 }
      );
    }

    const payment = await response.json();

    if (payment.status !== "PAID") {
      return NextResponse.json(
        { success: false, message: "결제가 완료되지 않았습니다." },
        { status: 400 }
      );
    }

    const paidAmount = payment.amount?.total ?? payment.amount?.paid ?? 0;
    if (paidAmount !== expectedAmount) {
      console.error(
        `금액 불일치: 기대=${expectedAmount}, 실제=${paidAmount}`
      );
      return NextResponse.json(
        { success: false, message: "결제 금액이 일치하지 않습니다." },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, payment });
  } catch (error) {
    console.error("결제 검증 오류:", error);
    return NextResponse.json(
      { success: false, message: "결제 검증 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
