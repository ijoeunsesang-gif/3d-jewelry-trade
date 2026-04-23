import { NextRequest, NextResponse } from "next/server";
import { r2Upload, r2PublicUrl } from "@/lib/r2";

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
    const contentType = file.type || "application/octet-stream";

    await r2Upload(bucket, path, buffer, contentType);

    const url = bucket === "thumbnails" ? r2PublicUrl(path) : path;
    return NextResponse.json({ url, path });
  } catch (e: any) {
    console.error("R2 업로드 실패:", e);
    return NextResponse.json({ error: e.message || "업로드 실패" }, { status: 500 });
  }
}
