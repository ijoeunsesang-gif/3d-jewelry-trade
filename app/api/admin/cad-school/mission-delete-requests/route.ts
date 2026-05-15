import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkAdmin(token: string): Promise<string | null> {
  const { data: { user }, error } = await adminSupabase.auth.getUser(token);
  if (error || !user) return null;
  const { data: profile } = await adminSupabase.from("profiles").select("role").eq("id", user.id).single();
  return profile?.role === "admin" ? user.id : null;
}

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  if (!(await checkAdmin(token))) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

  const { data } = await adminSupabase
    .from("cad_mission_deletion_requests")
    .select(`
      id, reason, status, admin_note, created_at, updated_at,
      mission:cad_missions(id, title),
      requester:profiles!cad_mission_deletion_requests_user_id_fkey(nickname, email)
    `)
    .order("created_at", { ascending: false });

  return NextResponse.json({ requests: data ?? [] });
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  if (!(await checkAdmin(token))) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

  const { request_id, action, admin_note } = await req.json();
  if (!request_id || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const { data: dr } = await adminSupabase
    .from("cad_mission_deletion_requests")
    .select("id, mission_id, user_id, status")
    .eq("id", request_id)
    .single();

  if (!dr) return NextResponse.json({ error: "요청을 찾을 수 없습니다." }, { status: 404 });
  if (dr.status !== "pending") return NextResponse.json({ error: "이미 처리된 요청입니다." }, { status: 400 });

  if (action === "approve") {
    // 미션 삭제
    const { data: missionData } = await adminSupabase
      .from("cad_missions")
      .select("title")
      .eq("id", dr.mission_id)
      .single();

    await adminSupabase.from("cad_missions").delete().eq("id", dr.mission_id);

    // 삭제 요청 상태 업데이트
    await adminSupabase
      .from("cad_mission_deletion_requests")
      .update({ status: "approved", admin_note: admin_note ?? null, updated_at: new Date().toISOString() })
      .eq("id", request_id);

    // 작성자에게 알림
    await adminSupabase.from("notifications").insert({
      user_id: dr.user_id,
      type: "mission_delete_approved",
      title: `미션 삭제 승인: "${missionData?.title ?? "미션"}"`,
      link: "/cad-school?tab=mission",
    });
  } else {
    await adminSupabase
      .from("cad_mission_deletion_requests")
      .update({ status: "rejected", admin_note: admin_note ?? null, updated_at: new Date().toISOString() })
      .eq("id", request_id);

    // 작성자에게 알림
    const { data: missionData } = await adminSupabase
      .from("cad_missions")
      .select("title")
      .eq("id", dr.mission_id)
      .single();

    await adminSupabase.from("notifications").insert({
      user_id: dr.user_id,
      type: "mission_delete_rejected",
      title: `미션 삭제 거절: "${missionData?.title ?? "미션"}"`,
      link: `/cad-school/mission/${dr.mission_id}`,
    });
  }

  return NextResponse.json({ ok: true });
}
