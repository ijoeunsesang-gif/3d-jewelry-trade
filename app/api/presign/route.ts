import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { r2PresignedPutUrl } from "@/lib/r2";

// models-private 버킷만 허용 — 브라우저가 직접 R2에 PUT하는 용도
const ALLOWED_BUCKETS = ["models-private"];
const ALLOWED_EXTS = ["stl", "obj", "3dm", "jpg", "jpeg", "png", "webp"];

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
    const { bucket, path, contentType } = await req.json();

    if (!bucket || !path) {
      return NextResponse.json({ error: "bucket, path가 필요합니다." }, { status: 400 });
    }

    if (!ALLOWED_BUCKETS.includes(bucket)) {
      return NextResponse.json({ error: "허용되지 않은 버킷입니다." }, { status: 400 });
    }

    // 경로 순회 방지
    if (hasDotDot(path)) {
      return NextResponse.json({ error: "허용되지 않은 경로입니다." }, { status: 400 });
    }

    // 파일 확장자 검증
    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_EXTS.includes(ext)) {
      return NextResponse.json(
        { error: `허용되지 않은 파일 형식입니다. (${ALLOWED_EXTS.join(", ")})` },
        { status: 400 }
      );
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
