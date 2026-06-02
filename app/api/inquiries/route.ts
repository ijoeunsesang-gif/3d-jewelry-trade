import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

  const { data: { user }, error: authErr } = await adminSupabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "인증 실패" }, { status: 401 });

  const { title, content } = await req.json();
  if (!title?.trim() || !content?.trim()) {
    return NextResponse.json({ error: "제목과 내용이 필요합니다." }, { status: 400 });
  }

  const { data: inquiry, error: insertErr } = await adminSupabase
    .from("inquiries")
    .insert({
      user_id: user.id,
      user_email: user.email || "",
      title: title.trim(),
      content: content.trim(),
      status: "pending",
    })
    .select("id")
    .single();

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  // 관리자 전원에게 알림
  const { data: admins } = await adminSupabase
    .from("profiles")
    .select("id")
    .eq("role", "admin");

  if (admins && admins.length > 0) {
    await adminSupabase.from("notifications").insert(
      admins.map((a: { id: string }) => ({
        user_id: a.id,
        type: "inquiry",
        title: `새로운 고객 문의가 접수되었습니다: ${title.trim()}`,
        link: "/admin",
        is_read: false,
      }))
    );
  }

  return NextResponse.json({ success: true, id: inquiry.id });
}
