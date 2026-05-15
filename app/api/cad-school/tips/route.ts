import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page   = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const search = searchParams.get("search")?.trim() ?? "";
  const limit  = 10;
  const offset = (page - 1) * limit;

  let query = adminSupabase
    .from("cad_tips")
    .select(
      `id, title, content, images, like_count, bookmark_count, comment_count, created_at,
       mentor:cad_mentors!mentor_id(
         id, avg_rating, career_start_year,
         profiles(nickname, avatar_url)
       )`,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);
  }

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ tips: data ?? [], total: count ?? 0 });
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

  const { data: { user }, error: authErr } = await adminSupabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "인증 실패" }, { status: 401 });

  // 멘토 확인
  const { data: mentor } = await adminSupabase
    .from("cad_mentors")
    .select("id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!mentor) return NextResponse.json({ error: "멘토만 팁을 작성할 수 있습니다." }, { status: 403 });

  try {
    const { title, content, images } = await req.json();
    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json({ error: "제목과 내용을 입력해주세요." }, { status: 400 });
    }

    const { data: tip, error: tipErr } = await adminSupabase
      .from("cad_tips")
      .insert({
        mentor_id: mentor.id,
        title: title.trim(),
        content: content.trim(),
        images: images ?? [],
      })
      .select("id")
      .single();

    if (tipErr) return NextResponse.json({ error: tipErr.message }, { status: 500 });

    // 포인트 지급
    const { data: config } = await adminSupabase
      .from("cad_point_configs")
      .select("value")
      .eq("key", "tip_post_reward")
      .single();

    const reward = config?.value ?? 100;
    if (reward > 0) {
      await adminSupabase.from("points").insert({
        user_id: user.id,
        amount: reward,
        reason: "캐드스쿨 멘토 팁 작성",
        reference_id: tip.id,
      });
      await adminSupabase.rpc("increment_profile_points", { uid: user.id, delta: reward });

      await adminSupabase.from("notifications").insert({
        user_id: user.id,
        type: "cad_tip_posted",
        title: `팁이 등록되었습니다 (+${reward}P)`,
        link: `/cad-school/tips/${tip.id}`,
        is_read: false,
      });
    }

    return NextResponse.json({ id: tip.id });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "오류 발생" }, { status: 500 });
  }
}
