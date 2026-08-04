import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAdminUser } from "@/lib/isAdminCheck";
import { EVENT_SETTINGS_ID, EVENT_GRADE_THRESHOLDS } from "@/lib/eventGrade";

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

// 이벤트 조건 충족 확인 후 등급 승인 — 클라이언트 버튼 활성화와 별개로 서버에서 유효개수를 재검증한다.
export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }

  const { sellerId, toGrade } = await req.json();
  const threshold = EVENT_GRADE_THRESHOLDS.find((t) => t.grade === toGrade);
  if (!sellerId || !threshold) {
    return NextResponse.json({ error: "sellerId, toGrade(skilled|pro) 필요" }, { status: 400 });
  }

  const { data: settings } = await adminSupabase
    .from("event_settings")
    .select("start_date, end_date")
    .eq("id", EVENT_SETTINGS_ID)
    .maybeSingle();

  if (!settings?.start_date || !settings?.end_date) {
    return NextResponse.json({ error: "이벤트 기간이 설정되지 않았습니다." }, { status: 400 });
  }

  const { data: models, error: modelsError } = await adminSupabase
    .from("models")
    .select("id")
    .eq("seller_id", sellerId)
    .gte("created_at", settings.start_date)
    .lte("created_at", settings.end_date);

  if (modelsError) return NextResponse.json({ error: modelsError.message }, { status: 500 });

  const modelIds = (models ?? []).map((m) => m.id);
  const { count: invalidCount, error: invalidError } = modelIds.length
    ? await adminSupabase
        .from("event_invalid_models")
        .select("id", { count: "exact", head: true })
        .in("model_id", modelIds)
    : { count: 0, error: null };

  if (invalidError) return NextResponse.json({ error: invalidError.message }, { status: 500 });

  const validCount = modelIds.length - (invalidCount ?? 0);
  if (validCount < threshold.count) {
    return NextResponse.json(
      { error: `유효 업로드 ${validCount}개 — ${threshold.count}개 이상이어야 승인할 수 있습니다.` },
      { status: 400 }
    );
  }

  const { data: profile, error: profileError } = await adminSupabase
    .from("profiles")
    .select("grade")
    .eq("id", sellerId)
    .single();

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

  const fromGrade = profile.grade || "sprout";
  if (fromGrade === toGrade) {
    return NextResponse.json({ error: "이미 해당 등급입니다." }, { status: 400 });
  }

  const { error: updateError } = await adminSupabase
    .from("profiles")
    .update({ grade: toGrade })
    .eq("id", sellerId);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  await adminSupabase.from("grade_change_logs").insert({
    user_id: sellerId,
    from_grade: fromGrade,
    to_grade: toGrade,
    reason: `등급 상향 이벤트 승인 (유효 업로드 ${validCount}개)`,
    changed_by: admin.id,
  });

  return NextResponse.json({ success: true, fromGrade, toGrade, validCount });
}
