import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { paymentKey, orderId, amount } = await req.json();

    if (!paymentKey || !orderId || typeof amount !== "number") {
      return NextResponse.json(
        { success: false, message: "잘못된 요청입니다." },
        { status: 400 }
      );
    }

    const secretKey = process.env.TOSSPAYMENTS_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json(
        { success: false, message: "서버 설정 오류입니다." },
        { status: 500 }
      );
    }

    // 토스페이먼츠 결제 승인 API
    // Basic 인증: Base64(secretKey + ":")
    const auth = Buffer.from(`${secretKey}:`).toString("base64");

    const response = await fetch(
      "https://api.tosspayments.com/v1/payments/confirm",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ paymentKey, orderId, amount }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("토스페이먼츠 승인 오류:", data);
      return NextResponse.json(
        { success: false, message: data.message ?? "결제 승인에 실패했습니다." },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true, payment: data });
  } catch (error) {
    console.error("결제 승인 오류:", error);
    return NextResponse.json(
      { success: false, message: "결제 승인 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
