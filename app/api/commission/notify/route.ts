import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("[notify] 환경변수 누락: NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY");
    return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
  }

  const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json();
    const { user_id, type, title, content, link } = body;

    if (!user_id || !title) {
      return NextResponse.json({ error: "user_id, title이 필요합니다." }, { status: 400 });
    }

    const { error } = await adminSupabase.from("notifications").insert({
      user_id,
      type: type || "commission",
      title,
      content: content || null,
      link: link || null,
      is_read: false,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("[notify] insert 실패:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[notify] 예외:", e);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
