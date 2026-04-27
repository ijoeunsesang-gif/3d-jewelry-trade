import { NextRequest, NextResponse } from "next/server";
import { r2PresignedPutUrl } from "@/lib/r2";

// models-private 버킷만 허용 — 브라우저가 직접 R2에 PUT하는 용도
const ALLOWED_BUCKETS = ["models-private"];

export async function POST(req: NextRequest) {
  try {
    const { bucket, path, contentType } = await req.json();

    if (!bucket || !path) {
      return NextResponse.json({ error: "bucket, path가 필요합니다." }, { status: 400 });
    }
    if (!ALLOWED_BUCKETS.includes(bucket)) {
      return NextResponse.json({ error: "허용되지 않은 버킷입니다." }, { status: 400 });
    }

    const presignedUrl = await r2PresignedPutUrl(
      bucket,
      path,
      contentType || "application/octet-stream",
    );
    return NextResponse.json({ presignedUrl, path });
  } catch (e: any) {
    const message = e?.message || String(e);
    const code = e?.Code || e?.code || e?.name || "";
    const detail = code ? `[${code}] ${message}` : message;
    console.error("presign 실패:", detail, e);
    return NextResponse.json({ error: detail || "presign 실패" }, { status: 500 });
  }
}
