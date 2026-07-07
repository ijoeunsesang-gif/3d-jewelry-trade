import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAdminUser } from "@/lib/isAdminCheck";

// Service role client — bypasses RLS for admin-only access
const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function requireAdmin(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) {
    return { error: NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 }) };
  }

  const { data: { user }, error: authError } = await adminSupabase.auth.getUser(token);
  if (authError || !user) {
    return { error: NextResponse.json({ error: "인증 실패" }, { status: 401 }) };
  }

  if (!(await isAdminUser(adminSupabase, user.id))) {
    return { error: NextResponse.json({ error: "관리자만 접근 가능합니다." }, { status: 403 }) };
  }

  return { user };
}

// 팝업 목록 조회 (관리자용, 비활성 포함 전체)
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  const { data: popups, error } = await adminSupabase
    .from("popup_notices")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "조회 실패: " + error.message }, { status: 500 });
  }

  return NextResponse.json({ popups: popups || [] });
}

// 팝업 생성
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  let body: {
    title?: string;
    content?: string;
    image_url?: string;
    link_url?: string;
    is_active?: boolean;
    starts_at?: string | null;
    ends_at?: string | null;
  } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  if (!body.title && !body.content && !body.image_url) {
    return NextResponse.json({ error: "제목, 본문, 이미지 중 최소 하나는 입력해주세요." }, { status: 400 });
  }

  const { data: popup, error } = await adminSupabase
    .from("popup_notices")
    .insert({
      title: body.title ?? null,
      content: body.content ?? null,
      image_url: body.image_url ?? null,
      link_url: body.link_url ?? null,
      is_active: body.is_active ?? true,
      starts_at: body.starts_at || null,
      ends_at: body.ends_at || null,
    })
    .select()
    .single();

  if (error || !popup) {
    return NextResponse.json({ error: "생성 실패: " + error?.message }, { status: 500 });
  }

  return NextResponse.json({ popup });
}

// 팝업 수정
export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  let body: { id?: string; [key: string]: unknown } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  if (!body.id) {
    return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
  }

  const { id, ...updates } = body;

  const { data: popup, error } = await adminSupabase
    .from("popup_notices")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error || !popup) {
    return NextResponse.json({ error: "수정 실패: " + error?.message }, { status: 500 });
  }

  return NextResponse.json({ popup });
}

// 팝업 삭제 (hard delete)
export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
  }

  const { error } = await adminSupabase
    .from("popup_notices")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: "삭제 실패: " + error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
