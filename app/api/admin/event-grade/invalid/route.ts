import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAdminUser } from "@/lib/isAdminCheck";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyAdmin(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user }, error } = await adminSupabase.auth.getUser(token);
  if (error || !user) return null;
  if (!(await isAdminUser(adminSupabase, user.id))) return null;
  return user;
}

// 모델 무효 처리 토글 — 체크하면 event_invalid_models에 기록, 해제하면 삭제
export async function POST(req: NextRequest) {
  if (!(await verifyAdmin(req))) {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }

  const { modelId, invalid, reason } = await req.json();
  if (!modelId || typeof invalid !== "boolean") {
    return NextResponse.json({ error: "modelId, invalid 필요" }, { status: 400 });
  }

  if (invalid) {
    const { error } = await adminSupabase
      .from("event_invalid_models")
      .upsert({ model_id: modelId, reason: reason ?? null }, { onConflict: "model_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await adminSupabase
      .from("event_invalid_models")
      .delete()
      .eq("model_id", modelId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
