import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

    const { data: { user }, error: authErr } = await adminSupabase.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: "인증 실패" }, { status: 401 });

    const { modelId, sellerId, modelTitle, thumbnailUrl } = await req.json();
    if (!modelId || !sellerId || !modelTitle) {
      return NextResponse.json({ error: "필수 파라미터 누락" }, { status: 400 });
    }
    if (user.id !== sellerId) {
      return NextResponse.json({ error: "권한 없음" }, { status: 403 });
    }

    // notify_enabled=true 팔로워 조회
    const { data: followers } = await adminSupabase
      .from("follows")
      .select("follower_id")
      .eq("following_id", sellerId)
      .eq("notify_enabled", true);

    if (!followers?.length) return NextResponse.json({ success: true, notified: 0 });

    const followerIds: string[] = followers.map((f: any) => f.follower_id);

    // push_new_product=false 명시적으로 끈 유저 제외
    const { data: blocked } = await adminSupabase
      .from("notification_settings")
      .select("user_id")
      .in("user_id", followerIds)
      .eq("push_new_product", false);

    const blockedSet = new Set((blocked ?? []).map((s: any) => s.user_id));
    const targetIds = followerIds.filter((uid) => !blockedSet.has(uid));

    if (!targetIds.length) return NextResponse.json({ success: true, notified: 0 });

    // 판매자 닉네임 조회
    const { data: sellerProfile } = await adminSupabase
      .from("profiles")
      .select("nickname")
      .eq("id", sellerId)
      .single();
    const sellerName = sellerProfile?.nickname || "판매자";

    // in-app 알림 일괄 생성
    await adminSupabase.from("notifications").insert(
      targetIds.map((uid) => ({
        user_id: uid,
        type: "new_product",
        title: `${sellerName}님이 새 작품 "${modelTitle}"을 업로드했습니다`,
        link: `/models/${modelId}`,
        is_read: false,
      }))
    );

    // 이메일 발송 대기 레코드 생성
    await adminSupabase.from("pending_email_notifications").insert(
      targetIds.map((uid) => ({
        user_id: uid,
        seller_id: sellerId,
        seller_name: sellerName,
        model_id: modelId,
        model_name: modelTitle,
        model_image: thumbnailUrl || null,
      }))
    );

    return NextResponse.json({ success: true, notified: targetIds.length });
  } catch (err) {
    console.error("[notify-followers] 오류:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
