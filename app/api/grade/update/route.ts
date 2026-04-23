import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { calcGrade, gradeOrder, GRADE_CONFIG, Grade } from "@/lib/grades";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
const publicSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

    const { data: { user }, error: authErr } = await publicSupabase.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: "유효하지 않은 토큰" }, { status: 401 });

    const { purchases } = await req.json() as {
      purchases: { modelId: string; amount: number }[];
    };
    if (!purchases?.length) return NextResponse.json({ ok: true });

    // 모델별 seller_id 조회
    const modelIds = purchases.map((p) => p.modelId);
    const { data: models } = await adminSupabase
      .from("models")
      .select("id, seller_id")
      .in("id", modelIds);

    if (!models?.length) return NextResponse.json({ ok: true });

    // seller별 합산
    const sellerMap = new Map<string, { count: number; amount: number; modelIds: string[] }>();
    for (const purchase of purchases) {
      const model = models.find((m) => m.id === purchase.modelId);
      if (!model?.seller_id || model.seller_id === user.id) continue; // 자기 자신 구매 제외
      const existing = sellerMap.get(model.seller_id) ?? { count: 0, amount: 0, modelIds: [] };
      existing.count += 1;
      existing.amount += purchase.amount;
      existing.modelIds.push(purchase.modelId);
      sellerMap.set(model.seller_id, existing);
    }

    for (const [sellerId, delta] of sellerMap.entries()) {
      // seller_stats upsert
      const { data: stats } = await adminSupabase
        .from("seller_stats")
        .select("total_sales_count, total_sales_amount, current_grade")
        .eq("user_id", sellerId)
        .maybeSingle();

      const prevCount  = stats?.total_sales_count  ?? 0;
      const prevAmount = stats?.total_sales_amount  ?? 0;
      const prevGrade  = (stats?.current_grade ?? "sprout") as Grade;

      const newCount  = prevCount  + delta.count;
      const newAmount = prevAmount + delta.amount;
      const newGrade  = calcGrade(newCount, newAmount);

      await adminSupabase.from("seller_stats").upsert({
        user_id:            sellerId,
        total_sales_count:  newCount,
        total_sales_amount: newAmount,
        current_grade:      newGrade,
        updated_at:         new Date().toISOString(),
      }, { onConflict: "user_id" });

      // 등급 승급 시 profiles 업데이트 (강등 없음)
      if (gradeOrder(newGrade) > gradeOrder(prevGrade)) {
        await adminSupabase.from("profiles").update({ grade: newGrade }).eq("id", sellerId);
      }

      // sale_records 삽입
      const commissionRate = GRADE_CONFIG[newGrade].commission;
      const saleRows = delta.modelIds.map((modelId) => {
        const purchase = purchases.find((p) => p.modelId === modelId)!;
        const settlement = Math.round(purchase.amount * (1 - commissionRate));
        return {
          seller_id:         sellerId,
          buyer_id:          user.id,
          model_id:          modelId,
          amount:            purchase.amount,
          commission_rate:   commissionRate,
          settlement_amount: settlement,
        };
      });
      await adminSupabase.from("sale_records").insert(saleRows);
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("grade/update 오류:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
