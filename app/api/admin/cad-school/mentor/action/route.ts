import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Action = "suspend" | "unsuspend" | "revoke" | "cancel-warning";

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

  const { data: { user }, error: authErr } = await adminSupabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "인증 실패" }, { status: 401 });

  const { data: profile } = await adminSupabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "관리자만 접근 가능합니다." }, { status: 403 });

  try {
    const { mentor_id, action, warning_id } = (await req.json()) as { mentor_id: string; action: Action; warning_id?: string };
    if (!mentor_id || !action) return NextResponse.json({ error: "mentor_id와 action이 필요합니다." }, { status: 400 });

    const { data: mentor } = await adminSupabase
      .from("cad_mentors")
      .select("id, user_id, is_suspended, is_active, warning_count")
      .eq("id", mentor_id)
      .single();

    if (!mentor) return NextResponse.json({ error: "멘토를 찾을 수 없습니다." }, { status: 404 });

    const { data: mentorProfile } = await adminSupabase.from("profiles").select("nickname").eq("id", mentor.user_id).single();
    const mentorName = mentorProfile?.nickname ?? "멘토";

    if (action === "suspend") {
      const suspendedUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await adminSupabase.from("cad_mentors").update({ is_suspended: true, suspended_until: suspendedUntil }).eq("id", mentor_id);

      const { data: subs } = await adminSupabase
        .from("cad_subscriptions")
        .select("id, subscriber_id")
        .eq("mentor_id", mentor_id)
        .eq("status", "active");

      if (subs && subs.length > 0) {
        await adminSupabase.from("notifications").insert(
          (subs as { id: string; subscriber_id: string }[]).map((s) => ({
            user_id: s.subscriber_id,
            type: "cad_mentor_suspended",
            title: `${mentorName} 멘토가 활동 정지되었습니다. 멘토 교체 횟수 차감 없이 교체 가능합니다`,
            link: `/cad-school/subscription/${s.id}`,
            is_read: false,
          }))
        );
      }
      await adminSupabase.from("notifications").insert({
        user_id: mentor.user_id,
        type: "cad_mentor_suspended",
        title: "관리자에 의해 멘토 활동이 1개월 정지되었습니다",
        link: "/cad-school/my",
        is_read: false,
      });
    } else if (action === "unsuspend") {
      await adminSupabase.from("cad_mentors").update({ is_suspended: false, suspended_until: null }).eq("id", mentor_id);
      await adminSupabase.from("notifications").insert({
        user_id: mentor.user_id,
        type: "cad_mentor_unsuspended",
        title: "멘토 활동 정지가 해제되었습니다",
        link: "/cad-school/my",
        is_read: false,
      });
    } else if (action === "revoke") {
      await adminSupabase.from("cad_mentors").update({ is_active: false, is_suspended: true, suspended_until: null }).eq("id", mentor_id);
      await adminSupabase.from("notifications").insert({
        user_id: mentor.user_id,
        type: "cad_mentor_revoked",
        title: "멘토 자격이 영구 박탈되었습니다. 문의사항은 고객센터로 연락해주세요",
        link: "/cad-school/my",
        is_read: false,
      });
    } else if (action === "cancel-warning") {
      if (!warning_id) return NextResponse.json({ error: "warning_id가 필요합니다." }, { status: 400 });
      await adminSupabase.from("cad_mentor_warnings").delete().eq("id", warning_id);
      const newCount = Math.max(0, mentor.warning_count - 1);
      await adminSupabase.from("cad_mentors").update({ warning_count: newCount }).eq("id", mentor_id);
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "오류 발생" }, { status: 500 });
  }
}
