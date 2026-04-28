import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { user_id, type, message, link } = await req.json();
    if (!user_id || !message) {
      return NextResponse.json({ error: "user_id, message가 필요합니다." }, { status: 400 });
    }
    const { error } = await adminSupabase.from("notifications").insert({
      user_id, type: type || "commission", message, link, is_read: false,
    });
    if (error) {
      console.error("notification insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
