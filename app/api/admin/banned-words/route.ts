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

/** 금지어 목록 전체 조회 (인증 불필요 — 업로드 페이지에서도 사용) */
export async function GET() {
  const { data, error } = await adminSupabase
    .from("banned_words")
    .select("id, word, created_at")
    .order("word", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ words: data ?? [] });
}

/** 금지어 추가 (관리자 전용) */
export async function POST(req: NextRequest) {
  if (!(await verifyAdmin(req))) {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }

  const { word } = await req.json();
  const trimmed = word?.trim().toLowerCase();
  if (!trimmed) {
    return NextResponse.json({ error: "단어를 입력하세요." }, { status: 400 });
  }

  const { data, error } = await adminSupabase
    .from("banned_words")
    .insert({ word: trimmed })
    .select("id, word, created_at")
    .single();

  if (error) {
    const msg = error.code === "23505" ? "이미 등록된 단어입니다." : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json({ word: data });
}

/** 금지어 삭제 (관리자 전용) */
export async function DELETE(req: NextRequest) {
  if (!(await verifyAdmin(req))) {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });

  const { error } = await adminSupabase
    .from("banned_words")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
