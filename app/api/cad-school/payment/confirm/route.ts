import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  // 1. 인증
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

  const { data: { user }, error: authErr } = await adminSupabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "인증 실패" }, { status: 401 });

  // 2. 요청 파싱
  let body: {
    paymentKey?: string;
    orderId?: string;
    amount?: number;
    type?: string;
    mentorId?: string;
    planType?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }

  const { paymentKey, orderId, amount, type, mentorId, planType } = body;

  if (!paymentKey || !orderId || typeof amount !== "number" || !type) {
    return NextResponse.json({ error: "필수 정보가 누락되었습니다." }, { status: 400 });
  }

  // 3. 토스페이먼츠 결제 승인
  const secretKey = process.env.TOSSPAYMENTS_SECRET_KEY;
  if (!secretKey) return NextResponse.json({ error: "서버 설정 오류입니다." }, { status: 500 });

  const tossAuth = Buffer.from(`${secretKey}:`).toString("base64");
  const tossRes = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
    method: "POST",
    headers: {
      Authorization: `Basic ${tossAuth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ paymentKey, orderId, amount }),
  });
  const tossData = await tossRes.json();
  if (!tossRes.ok) {
    console.error("[cad-school/payment/confirm] Toss 승인 실패:", tossData);
    return NextResponse.json(
      { error: tossData.message || "결제 승인에 실패했습니다." },
      { status: 400 }
    );
  }

  // 플랜별 초기 횟수
  const PLAN_LIMITS: Record<string, { checklist_count: number; review_count: number; post_review_cad_count: number; mentor_change_count: number }> = {
    basic:  { checklist_count: 1, review_count: 1, post_review_cad_count: 1, mentor_change_count: 1 },
    pro:    { checklist_count: 2, review_count: 2, post_review_cad_count: 2, mentor_change_count: 2 },
    master: { checklist_count: 3, review_count: 3, post_review_cad_count: 3, mentor_change_count: 3 },
  };

  // 4. 타입별 DB 처리
  try {
    if (type === "subscription") {
      // ── 구독 결제 ──
      if (!mentorId || !planType) {
        return NextResponse.json({ error: "멘토/플랜 정보가 누락되었습니다." }, { status: 400 });
      }

      // 이미 활성 구독 확인
      const { data: existing } = await adminSupabase
        .from("cad_subscriptions")
        .select("id")
        .eq("subscriber_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      if (existing) {
        return NextResponse.json(
          { error: "이미 활성 수강 패키지가 있습니다. 기존 수강을 해지 후 다시 시도해주세요." },
          { status: 400 }
        );
      }

      // 멘토 확인
      const { data: mentor } = await adminSupabase
        .from("cad_mentors")
        .select("id, user_id, is_suspended")
        .eq("id", mentorId)
        .single();
      if (!mentor) return NextResponse.json({ error: "멘토를 찾을 수 없습니다." }, { status: 404 });
      if (mentor.is_suspended) return NextResponse.json({ error: "활동이 중단된 멘토입니다." }, { status: 400 });

      // 구독 생성
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const planLimits = PLAN_LIMITS[planType] ?? PLAN_LIMITS.basic;
      const { data: subscription, error: subErr } = await adminSupabase
        .from("cad_subscriptions")
        .insert({
          subscriber_id: user.id,
          mentor_id: mentorId,
          plan_type: planType,
          price: amount,
          payment_key: paymentKey,
          order_id: orderId,
          expires_at: expiresAt,
          ...planLimits,
        })
        .select("id")
        .single();
      if (subErr) throw new Error(subErr.message);

      // 닉네임 조회 + 알림
      const [{ data: subProfile }, { data: mentorProfile }] = await Promise.all([
        adminSupabase.from("profiles").select("nickname").eq("id", user.id).single(),
        adminSupabase.from("profiles").select("nickname").eq("id", mentor.user_id).single(),
      ]);
      const subscriberName = subProfile?.nickname ?? "구독자";
      const mentorName = mentorProfile?.nickname ?? "멘토";

      await adminSupabase.from("notifications").insert([
        {
          user_id: user.id,
          type: "cad_subscription",
          title: `${mentorName} 멘토와 수강이 시작되었습니다`,
          link: "/cad-school/my",
          is_read: false,
        },
        {
          user_id: mentor.user_id,
          type: "cad_subscription",
          title: `${subscriberName}님이 수강을 시작했습니다`,
          link: "/cad-school/my",
          is_read: false,
        },
      ]);

      return NextResponse.json({ ok: true, type: "subscription", id: subscription.id });

    } else if (type === "session") {
      const { mentorId, menteeId, title, description, files, sessionType } = body as any;
      if (!mentorId || !menteeId) {
        return NextResponse.json({ error: "멘토/멘티 정보가 누락되었습니다." }, { status: 400 });
      }

      // 멘토 확인
      const { data: mentor } = await adminSupabase
        .from("cad_mentors")
        .select("id, user_id")
        .eq("id", mentorId)
        .single();
      if (!mentor) return NextResponse.json({ error: "멘토를 찾을 수 없습니다." }, { status: 404 });

      // 세션 생성
      const { data: session, error: sessionErr } = await adminSupabase
        .from("cad_mentoring_sessions")
        .insert({
          mentor_id: mentorId,
          mentee_id: menteeId,
          session_type: sessionType,
          title: title || "유료 피드백 질문",
          description: description || "",
          files: files || [],
          price: amount,
          payment_key: paymentKey,
          order_id: orderId,
          status: "pending",
        })
        .select("id")
        .single();
      if (sessionErr) throw new Error(sessionErr.message);

      // 닉네임 조회
      const [{ data: menteeProfile }, { data: mentorProfile }] = await Promise.all([
        adminSupabase.from("profiles").select("nickname").eq("id", menteeId).single(),
        adminSupabase.from("profiles").select("nickname").eq("id", mentor.user_id).single(),
      ]);
      const menteeName = menteeProfile?.nickname ?? "멘티";
      const mentorName = mentorProfile?.nickname ?? "멘토";

      // 알림
      await adminSupabase.from("notifications").insert([
        {
          user_id: menteeId,
          type: "cad_session",
          title: `${mentorName} 멘토에게 질문이 완료되었습니다`,
          link: `/cad-school/session/${session.id}`,
          is_read: false,
        },
        {
          user_id: mentor.user_id,
          type: "cad_session",
          title: `${menteeName}님이 유료 피드백 질문을 남겼습니다`,
          link: `/cad-school/session/${session.id}`,
          is_read: false,
        },
      ]);

      return NextResponse.json({ ok: true, type: "session", id: session.id });

    } else {
      return NextResponse.json({ error: "유효하지 않은 결제 타입입니다." }, { status: 400 });
    }
  } catch (e: unknown) {
    console.error("[cad-school/payment/confirm] DB 처리 오류:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
