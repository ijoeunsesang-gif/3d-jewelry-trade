import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data, error } = await adminSupabase
    .from("cad_tip_comments")
    .select("id, content, image_url, created_at, profiles(nickname, avatar_url, grade)")
    .eq("tip_id", id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ comments: data ?? [] });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

  const { data: { user }, error: authErr } = await adminSupabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "인증 실패" }, { status: 401 });

  try {
    const { content, image_url } = await req.json();
    if (!content?.trim()) {
      return NextResponse.json({ error: "내용을 입력해주세요." }, { status: 400 });
    }

    const { data: tip } = await adminSupabase.from("cad_tips").select("id, comment_count").eq("id", id).single();
    if (!tip) return NextResponse.json({ error: "팁을 찾을 수 없습니다." }, { status: 404 });

    const { data: comment, error: commentErr } = await adminSupabase
      .from("cad_tip_comments")
      .insert({ tip_id: id, user_id: user.id, content: content.trim(), image_url: image_url ?? null })
      .select("id")
      .single();

    if (commentErr) return NextResponse.json({ error: commentErr.message }, { status: 500 });

    await adminSupabase
      .from("cad_tips")
      .update({ comment_count: tip.comment_count + 1 })
      .eq("id", id);

    return NextResponse.json({ id: comment.id });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "오류 발생" }, { status: 500 });
  }
}
