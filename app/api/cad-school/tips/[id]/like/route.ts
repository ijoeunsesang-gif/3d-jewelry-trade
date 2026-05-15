import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

  const { data: { user }, error: authErr } = await adminSupabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "인증 실패" }, { status: 401 });

  const { data: existing } = await adminSupabase
    .from("cad_tip_likes")
    .select("id")
    .eq("tip_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: tip } = await adminSupabase.from("cad_tips").select("like_count").eq("id", id).single();
  if (!tip) return NextResponse.json({ error: "팁을 찾을 수 없습니다." }, { status: 404 });

  if (existing) {
    await adminSupabase.from("cad_tip_likes").delete().eq("id", existing.id);
    const newCount = Math.max(0, tip.like_count - 1);
    await adminSupabase.from("cad_tips").update({ like_count: newCount }).eq("id", id);
    return NextResponse.json({ liked: false, like_count: newCount });
  } else {
    await adminSupabase.from("cad_tip_likes").insert({ tip_id: id, user_id: user.id });
    const newCount = tip.like_count + 1;
    await adminSupabase.from("cad_tips").update({ like_count: newCount }).eq("id", id);
    return NextResponse.json({ liked: true, like_count: newCount });
  }
}
