import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type AddonType = "checklist" | "review" | "post_review_cad";

const EXTRA_LIMIT_FIELD: Record<AddonType, string> = {
  checklist:       "checklist_extra_limit",
  review:          "review_extra_limit",
  post_review_cad: "post_review_cad_extra_limit",
};

const ADDON_LABELS: Record<AddonType, string> = {
  checklist:       "CAD수정",
  review:          "실무검수",
  post_review_cad: "검수+CAD수정",
};

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

  const { data: { user }, error: authErr } = await adminSupabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "인증 실패" }, { status: 401 });

  try {
    const { subscription_id, addon_type, price, order_id } = await req.json() as {
      subscription_id: string;
      addon_type: AddonType;
      price: number;
      order_id: string;
    };

    if (!subscription_id || !addon_type || !price || !order_id) {
      return NextResponse.json({ error: "필수 정보가 누락되었습니다." }, { status: 400 });
    }
    if (!["checklist", "review", "post_review_cad"].includes(addon_type)) {
      return NextResponse.json({ error: "유효하지 않은 addon 타입입니다." }, { status: 400 });
    }

    // 구독 확인 (본인 + active)
    const { data: sub } = await adminSupabase
      .from("cad_subscriptions")
      .select("id, subscriber_id, status, checklist_extra_limit, review_extra_limit, post_review_cad_extra_limit")
      .eq("id", subscription_id)
      .single();

    if (!sub) return NextResponse.json({ error: "수강 패키지를 찾을 수 없습니다." }, { status: 404 });
    if (sub.subscriber_id !== user.id) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    if (sub.status !== "active") return NextResponse.json({ error: "활성 수강 패키지에서만 가능합니다." }, { status: 400 });

    // 중복 주문 체크
    const { data: existing } = await adminSupabase
      .from("cad_addon_purchases")
      .select("id")
      .eq("order_id", order_id)
      .maybeSingle();
    if (existing) return NextResponse.json({ error: "이미 처리된 주문입니다." }, { status: 409 });

    // addon_purchases 기록
    await adminSupabase.from("cad_addon_purchases").insert({
      subscription_id,
      user_id: user.id,
      addon_type,
      price,
      order_id,
      status: "completed",
    });

    // extra_limit +1 (해당 타입 한도 1 증가)
    const extraField = EXTRA_LIMIT_FIELD[addon_type];
    const currentExtra = (sub as Record<string, number>)[extraField] ?? 0;
    await adminSupabase
      .from("cad_subscriptions")
      .update({ [extraField]: currentExtra + 1, updated_at: new Date().toISOString() })
      .eq("id", subscription_id);

    await adminSupabase.from("notifications").insert({
      user_id: user.id,
      type: "cad_addon",
      title: `이용권 추가 구매 완료: ${ADDON_LABELS[addon_type]} 1회`,
      link: `/cad-school/subscription/${subscription_id}`,
      is_read: false,
    });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "오류 발생" }, { status: 500 });
  }
}
