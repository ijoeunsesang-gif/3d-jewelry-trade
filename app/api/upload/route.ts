import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { r2Upload, r2PublicUrl } from "@/lib/r2";

export const maxDuration = 60;

const ALLOWED_BUCKETS = ["thumbnails", "models-private"];

const ALLOWED_IMAGE_EXTS = ["jpg", "jpeg", "png", "webp", "gif"];
const ALLOWED_MODEL_EXTS = ["stl", "obj", "3dm"];

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;   // 10MB
const MAX_MODEL_SIZE = 500 * 1024 * 1024;  // 500MB

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getExt(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

function hasDotDot(p: string): boolean {
  return p.includes("..") || p.startsWith("/");
}

export async function POST(req: NextRequest) {
  // 인증 확인
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const { data: { user }, error: authErr } = await adminSupabase.auth.getUser(token);
  if (authErr || !user) {
    return NextResponse.json({ error: "인증 실패" }, { status: 401 });
  }

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

    // 경로 순회 방지
    if (hasDotDot(path)) {
      return NextResponse.json({ error: "허용되지 않은 경로입니다." }, { status: 400 });
    }

    const ext = getExt(file.name || path);

    if (bucket === "thumbnails") {
      if (!ALLOWED_IMAGE_EXTS.includes(ext)) {
        return NextResponse.json(
          { error: `이미지 파일만 허용됩니다. (${ALLOWED_IMAGE_EXTS.join(", ")})` },
          { status: 400 }
        );
      }
      if (file.size > MAX_IMAGE_SIZE) {
        return NextResponse.json({ error: "이미지는 10MB 이하만 허용됩니다." }, { status: 400 });
      }
    } else {
      // models-private
      const allAllowed = [...ALLOWED_IMAGE_EXTS, ...ALLOWED_MODEL_EXTS];
      if (!allAllowed.includes(ext)) {
        return NextResponse.json(
          { error: `허용되지 않은 파일 형식입니다. (${allAllowed.join(", ")})` },
          { status: 400 }
        );
      }
      if (file.size > MAX_MODEL_SIZE) {
        return NextResponse.json({ error: "3D 파일은 500MB 이하만 허용됩니다." }, { status: 400 });
      }
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const contentType = bucket === "thumbnails"
      ? (file.type || "image/jpeg")
      : "application/octet-stream";

    await r2Upload(bucket, path, buffer, contentType);

    const url = bucket === "thumbnails" ? r2PublicUrl(path) : path;
    return NextResponse.json({ url, path });
  } catch (e: any) {
    const message = e?.message || String(e);
    const code = e?.Code || e?.code || e?.name || "";
    const httpStatus = e?.$metadata?.httpStatusCode;
    const detail = [code && `[${code}]`, message, httpStatus && `(HTTP ${httpStatus})`]
      .filter(Boolean).join(" ");
    console.error("R2 업로드 실패:", detail, e);
    return NextResponse.json({ error: detail || "업로드 실패" }, { status: 500 });
  }
}
