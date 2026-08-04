import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAdminUser } from "@/lib/isAdminCheck";
import { getModelThumbnailUrl } from "@/lib/imageUrl";
import { EVENT_SETTINGS_ID, EVENT_GRADE_THRESHOLDS } from "@/lib/eventGrade";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type SellerModelRow = { id: string; title: string; thumbnailUrl: string; createdAt: string; invalid: boolean };
type SellerEntry = {
  sellerId: string;
  nickname: string;
  grade: string;
  total: number;
  invalidCount: number;
  models: SellerModelRow[];
};

async function verifyAdmin(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user }, error } = await adminSupabase.auth.getUser(token);
  if (error || !user) return null;
  if (!(await isAdminUser(adminSupabase, user.id))) return null;
  return user;
}

// 참가자별 총/무효/유효 업로드 개수를 그 시점에 한 번 집계한다(단발성 이벤트라 캐싱 불필요).
export async function GET(req: NextRequest) {
  if (!(await verifyAdmin(req))) {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }

  const { data: settings } = await adminSupabase
    .from("event_settings")
    .select("id, start_date, end_date, is_active")
    .eq("id", EVENT_SETTINGS_ID)
    .maybeSingle();

  if (!settings?.start_date || !settings?.end_date) {
    return NextResponse.json({ settings: settings ?? null, participants: [] });
  }

  const { data: models, error: modelsError } = await adminSupabase
    .from("models")
    .select("id, title, thumbnail, thumbnail_path, seller_id, created_at")
    .gte("created_at", settings.start_date)
    .lte("created_at", settings.end_date)
    .order("created_at", { ascending: false });

  if (modelsError) return NextResponse.json({ error: modelsError.message }, { status: 500 });
  if (!models?.length) return NextResponse.json({ settings, participants: [] });

  const sellerIds = [...new Set(models.map((m) => m.seller_id).filter(Boolean))];
  const modelIds = models.map((m) => m.id);

  const [{ data: invalidRows }, { data: profiles }] = await Promise.all([
    adminSupabase.from("event_invalid_models").select("model_id").in("model_id", modelIds),
    adminSupabase.from("profiles").select("id, nickname, grade").in("id", sellerIds),
  ]);

  const invalidSet = new Set((invalidRows ?? []).map((r) => r.model_id));
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const bySeller = new Map<string, SellerEntry>();

  for (const m of models) {
    if (!m.seller_id) continue;
    const invalid = invalidSet.has(m.id);
    const entry: SellerEntry = bySeller.get(m.seller_id) ?? {
      sellerId: m.seller_id,
      nickname: profileMap.get(m.seller_id)?.nickname || m.seller_id.slice(0, 8),
      grade: profileMap.get(m.seller_id)?.grade || "sprout",
      total: 0,
      invalidCount: 0,
      models: [],
    };
    entry.total += 1;
    if (invalid) entry.invalidCount += 1;
    entry.models.push({
      id: m.id,
      title: m.title,
      thumbnailUrl: getModelThumbnailUrl(m),
      createdAt: m.created_at,
      invalid,
    });
    bySeller.set(m.seller_id, entry);
  }

  const participants = [...bySeller.values()]
    .map((p) => {
      const validCount = p.total - p.invalidCount;
      return {
        ...p,
        validCount,
        eligibleGrades: EVENT_GRADE_THRESHOLDS.filter((t) => validCount >= t.count).map((t) => t.grade),
      };
    })
    .sort((a, b) => b.validCount - a.validCount);

  return NextResponse.json({ settings, participants });
}

// 이벤트 기간 저장 — 고정 id 1행에 upsert
export async function PATCH(req: NextRequest) {
  if (!(await verifyAdmin(req))) {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }

  const { startDate, endDate, isActive } = await req.json();
  if (!startDate || !endDate) {
    return NextResponse.json({ error: "startDate, endDate 필요" }, { status: 400 });
  }

  const { error } = await adminSupabase.from("event_settings").upsert(
    {
      id: EVENT_SETTINGS_ID,
      start_date: startDate,
      end_date: endDate,
      is_active: isActive ?? true,
    },
    { onConflict: "id" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
