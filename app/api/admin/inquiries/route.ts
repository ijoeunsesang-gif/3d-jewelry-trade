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

export async function GET(req: NextRequest) {
  if (!(await verifyAdmin(req))) {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }

  const { data, error } = await adminSupabase
    .from("inquiries")
    .select("id, user_id, user_email, title, content, status, answer, answered_at, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function PATCH(req: NextRequest) {
  if (!(await verifyAdmin(req))) {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }

  const { id, answer } = await req.json();
  if (!id || !answer?.trim()) {
    return NextResponse.json({ error: "id, answer가 필요합니다." }, { status: 400 });
  }

  const { data: inquiry, error: fetchErr } = await adminSupabase
    .from("inquiries")
    .select("user_id, title")
    .eq("id", id)
    .single();

  if (fetchErr || !inquiry) {
    return NextResponse.json({ error: "문의를 찾을 수 없습니다." }, { status: 404 });
  }

  const { error } = await adminSupabase
    .from("inquiries")
    .update({
      answer: answer.trim(),
      answered_at: new Date().toISOString(),
      status: "answered",
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 문의자에게 답변 알림
  await adminSupabase.from("notifications").insert({
    user_id: inquiry.user_id,
    type: "inquiry",
    title: `문의 답변이 등록되었습니다: ${inquiry.title}`,
    link: "/customer-service",
    is_read: false,
  });

  return NextResponse.json({ success: true });
}
