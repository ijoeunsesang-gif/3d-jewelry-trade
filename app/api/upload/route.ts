import { NextRequest, NextResponse } from "next/server";
import { r2Upload, r2PublicUrl } from "@/lib/r2";

export const maxDuration = 60;

const ALLOWED_BUCKETS = ["thumbnails", "models-private"];

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const bucket = formData.get("bucket") as string | null;
    const path = formData.get("path") as string | null;

    if (!file || !bucket || !path) {
      return NextResponse.json({ error: "file, bucket, path가 필요합니다." }, { status: 400 });
    }
    if (!ALLOWED_BUCKETS.includes(bucket)) {
      return NextResponse.json({ error: "허용되지 않은 버킷입니다." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    // STL/OBJ/3DM은 file.type이 빈 문자열인 경우가 많아 명시적으로 지정
    const contentType = bucket === "thumbnails"
      ? (file.type || "image/jpeg")
      : "application/octet-stream";

    await r2Upload(bucket, path, buffer, contentType);

    const url = bucket === "thumbnails" ? r2PublicUrl(path) : path;
    return NextResponse.json({ url, path });
  } catch (e: any) {
    // S3/R2 SDK 에러는 name, Code, $metadata 등에 원인이 담겨 있음
    const message = e?.message || String(e);
    const code = e?.Code || e?.code || e?.name || "";
    const httpStatus = e?.$metadata?.httpStatusCode;
    const detail = [code && `[${code}]`, message, httpStatus && `(HTTP ${httpStatus})`]
      .filter(Boolean).join(" ");
    console.error("R2 업로드 실패:", detail, e);
    return NextResponse.json({ error: detail || "업로드 실패" }, { status: 500 });
  }
}
