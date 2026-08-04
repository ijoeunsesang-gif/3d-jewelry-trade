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

// 변경 이력 조회 (최근 200건)
export async function GET(req: NextRequest) {
  if (!(await verifyAdmin(req))) {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }

  const { data: logs, error } = await adminSupabase
    .from("grade_change_logs")
    .select("id, user_id, from_grade, to_grade, reason, changed_by, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!logs?.length) return NextResponse.json({ data: [] });

  const profileIds = [...new Set(logs.flatMap((l) => [l.user_id, l.changed_by].filter(Boolean)))];
  const { data: profiles } = await adminSupabase
    .from("profiles")
    .select("id, nickname")
    .in("id", profileIds as string[]);

  const nicknameMap = new Map((profiles ?? []).map((p) => [p.id, p.nickname]));

  return NextResponse.json({
    data: logs.map((l) => ({
      ...l,
      user_nickname: nicknameMap.get(l.user_id) || l.user_id.slice(0, 8),
      changed_by_nickname: l.changed_by ? nicknameMap.get(l.changed_by) || l.changed_by.slice(0, 8) : null,
    })),
  });
}

// 수동 등급 변경 — 상향/하향 모두 가능하되 사유 필수, 자동 변경 없음
export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }

  const { userId, toGrade, reason } = await req.json();
  const VALID_GRADES = new Set(["sprout", "skilled", "pro", "master"]);

  if (!userId || !VALID_GRADES.has(toGrade)) {
    return NextResponse.json({ error: "userId, toGrade(sprout|skilled|pro|master) 필요" }, { status: 400 });
  }
  if (!reason || !reason.trim()) {
    return NextResponse.json({ error: "사유를 입력해야 합니다." }, { status: 400 });
  }

  const { data: profile, error: profileError } = await adminSupabase
    .from("profiles")
    .select("grade")
    .eq("id", userId)
    .single();

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

  const fromGrade = profile.grade || "sprout";
  if (fromGrade === toGrade) {
    return NextResponse.json({ error: "이미 해당 등급입니다." }, { status: 400 });
  }

  const { error: updateError } = await adminSupabase
    .from("profiles")
    .update({ grade: toGrade })
    .eq("id", userId);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  const { error: logError } = await adminSupabase.from("grade_change_logs").insert({
    user_id: userId,
    from_grade: fromGrade,
    to_grade: toGrade,
    reason: reason.trim(),
    changed_by: admin.id,
  });

  if (logError) return NextResponse.json({ error: logError.message }, { status: 500 });

  return NextResponse.json({ success: true, fromGrade, toGrade });
}
