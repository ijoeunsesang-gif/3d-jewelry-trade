import { NextRequest, NextResponse } from "next/server";

const ALLOWED_ORIGIN = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const url = searchParams.get("url");
  const filename = searchParams.get("filename") || "image.jpg";

  if (!url) {
    return NextResponse.json({ error: "url이 필요합니다." }, { status: 400 });
  }

  // SSRF 방지: 허용된 R2 public 도메인의 URL만 프록시
  if (ALLOWED_ORIGIN && !url.startsWith(ALLOWED_ORIGIN)) {
    return NextResponse.json({ error: "허용되지 않은 URL입니다." }, { status: 403 });
  }

  try {
    const imageRes = await fetch(url);
    if (!imageRes.ok) {
      return NextResponse.json({ error: "이미지를 가져올 수 없습니다." }, { status: 502 });
    }

    const contentType = imageRes.headers.get("content-type") || "image/jpeg";
    const buffer = await imageRes.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    console.error("[download-image] fetch 실패:", e?.message);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
