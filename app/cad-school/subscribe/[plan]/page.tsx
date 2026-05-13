"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabase-browser";
import GradeBadge from "../../../components/GradeBadge";
import ReputationBadge from "../../../components/ReputationBadge";
import { Grade } from "@/lib/grades";
import { getAccessToken, decodeJwt } from "@/lib/supabase-fetch";
import { showError, showInfo } from "../../../lib/toast";
import { loadTossPayments, ANONYMOUS } from "@tosspayments/tosspayments-sdk";

const GOLD = "#c9a84c";
const GOLD_LIGHT = "#fdf6e3";
const CURRENT_YEAR = new Date().getFullYear();

const PLAN_INFO = {
  basic:  { label: "BASIC",  price: 19900, mentorChanges: 1, responseTime: "48시간" },
  pro:    { label: "PRO",    price: 39900, mentorChanges: 2, responseTime: "36시간" },
  master: { label: "MASTER", price: 79000, mentorChanges: 3, responseTime: "24시간" },
} as const;

type PlanKey = keyof typeof PLAN_INFO;

type Mentor = {
  id: string;
  user_id: string;
  intro: string;
  career_start_year: number | null;
  avg_rating: number;
  total_ratings: number;
  response_rate: number;
  profiles: { nickname: string | null; avatar_url: string | null; grade: string | null; reputation_scores?: { score: number }[] | null } | null;
};

export default function SubscribePlanPage() {
  const { plan } = useParams<{ plan: string }>();
  const router = useRouter();

  const planKey = (["basic", "pro", "master"].includes(plan ?? "") ? plan : "basic") as PlanKey;
  const planInfo = PLAN_INFO[planKey];

  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [loading, setLoading] = useState(true);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [paying, setPaying] = useState<string | null>(null);

  useEffect(() => {
    if (!["basic", "pro", "master"].includes(plan ?? "")) {
      router.push("/cad-school");
      return;
    }
    const token = getAccessToken();
    if (token) {
      const payload = decodeJwt(token) as { sub?: string } | null;
      setMyUserId(payload?.sub ?? null);
    }
    loadMentors();
  }, [plan]);

  const loadMentors = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("cad_mentors")
      .select("id, user_id, intro, career_start_year, avg_rating, total_ratings, response_rate, profiles(nickname, avatar_url, grade)")
      .eq("is_active", true)
      .eq("is_suspended", false)
      .order("avg_rating", { ascending: false });

    if (data) setMentors(data as unknown as Mentor[]);
    setLoading(false);
  };

  const handleSubscribe = async (mentor: Mentor) => {
    const token = getAccessToken();
    if (!token) { showInfo("로그인이 필요합니다."); router.push("/auth"); return; }
    if (myUserId === mentor.user_id) { showError("본인 멘토를 수강할 수 없습니다."); return; }

    const payload = decodeJwt(token) as { sub?: string; email?: string } | null;
    const orderId = `cad-sub-${Date.now()}`;

    localStorage.setItem("pendingCadPayment", JSON.stringify({
      type: "subscription",
      planType: planKey,
      mentorId: mentor.id,
      mentorName: mentor.profiles?.nickname ?? "멘토",
      subscriberId: payload?.sub,
      price: planInfo.price,
      orderId,
      orderName: `[캐드스쿨] ${planInfo.label} 30일`,
    }));

    setPaying(mentor.id);
    try {
      const clientKey = process.env.NEXT_PUBLIC_TOSSPAYMENTS_CLIENT_KEY!;
      const tossPayments = await loadTossPayments(clientKey);
      const payment = tossPayments.payment({ customerKey: payload?.sub ?? ANONYMOUS });
      await payment.requestPayment({
        method: "CARD",
        amount: { currency: "KRW", value: planInfo.price },
        orderId,
        orderName: `[캐드스쿨] ${planInfo.label} 30일`,
        successUrl: `${window.location.origin}/cad-school/payment/success`,
        failUrl: `${window.location.origin}/cad-school/payment/fail`,
        ...(payload?.email ? { customerEmail: payload.email } : {}),
        customerName: "구매자",
      });
    } catch (e: unknown) {
      const errObj = e !== null && typeof e === "object" ? (e as Record<string, unknown>) : {};
      const errCode = typeof errObj.code === "string" ? errObj.code : "";
      const errMsg = e instanceof Error ? e.message : typeof errObj.message === "string" ? errObj.message : "";
      if (!errMsg.includes("취소") && !errCode.includes("CANCELED")) {
        showError("결제 중 오류가 발생했습니다.");
      }
    } finally {
      setPaying(null);
    }
  };

  const planBg = planKey === "master" ? "#111827" : planKey === "pro" ? GOLD_LIGHT : "#f8fafc";
  const planBorder = planKey === "master" ? "#374151" : planKey === "pro" ? GOLD : "#e5e7eb";
  const planTextColor = planKey === "master" ? "white" : "#111827";

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "32px 20px 96px", fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <Link href="/cad-school" style={{ color: "#6b7280", textDecoration: "none", fontSize: 14 }}>← 캐드스쿨</Link>
        <span style={{ color: "#d1d5db" }}>/</span>
        <span style={{ fontSize: 14, color: "#111827", fontWeight: 700 }}>수강 패키지 · 멘토 선택</span>
      </div>

      {/* 플랜 요약 카드 */}
      <div style={{ background: planBg, border: `1.5px solid ${planBorder}`, borderRadius: 20, padding: "22px 24px", marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: planKey === "master" ? "rgba(255,255,255,0.5)" : "#9ca3af", letterSpacing: 2, marginBottom: 4 }}>선택한 패키지</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: planTextColor }}>{planInfo.label}</div>
            <div style={{ fontSize: 14, color: planKey === "master" ? "rgba(255,255,255,0.6)" : "#6b7280", marginTop: 4 }}>
              답변 {planInfo.responseTime} 내 · 월 {planInfo.mentorChanges}회 멘토 교체
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: planKey === "pro" ? "#92400e" : planTextColor }}>
              {planInfo.price.toLocaleString("ko-KR")}원
            </div>
            <div style={{ fontSize: 12, color: planKey === "master" ? "rgba(255,255,255,0.5)" : "#9ca3af" }}>30일 수강</div>
          </div>
        </div>
      </div>

      {/* 멘토 선택 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#111827" }}>멘토 선택</h2>
        <span style={{ fontSize: 13, color: "#6b7280" }}>{mentors.length}명의 멘토</span>
      </div>

      <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 12, padding: "12px 16px", marginBottom: 20, fontSize: 12, color: "#6b7280", lineHeight: 1.8 }}>
        💡 수강 시작 후 멘토 교체는 {planInfo.mentorChanges}회까지 가능합니다. 멘토 수익의 80%가 멘토에게 지급됩니다.
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#9ca3af", fontSize: 14 }}>불러오는 중...</div>
      ) : mentors.length === 0 ? (
        <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 18, padding: "60px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 14 }}>🎓</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#111827", marginBottom: 6 }}>등록된 멘토가 없습니다</div>
          <div style={{ fontSize: 13, color: "#9ca3af" }}>곧 멘토가 등록될 예정입니다.</div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {mentors.map((mentor) => {
            const isMe = myUserId === mentor.user_id;
            const isPaying = paying === mentor.id;
            const stars = Math.round(mentor.avg_rating);
            const careerYears = mentor.career_start_year ? CURRENT_YEAR - mentor.career_start_year : null;
            return (
              <div key={mentor.id} style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 18, padding: "20px 22px" }}>
                <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <Avatar url={mentor.profiles?.avatar_url} size={56} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 17, fontWeight: 800, color: "#111827" }}>
                        {mentor.profiles?.nickname ?? "멘토"}
                      </span>
                      {mentor.profiles?.grade && <GradeBadge grade={mentor.profiles.grade as Grade} size="sm" />}
                      {(() => { const s = mentor.profiles?.reputation_scores?.[0]?.score ?? 0; return s > 0 ? <ReputationBadge score={s} size="sm" /> : null; })()}
                      {careerYears !== null && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", background: "#f3f4f6", borderRadius: 6, padding: "2px 7px" }}>경력 {careerYears}년</span>
                      )}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
                      {mentor.total_ratings > 0 ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ color: GOLD, fontSize: 13, letterSpacing: -1 }}>
                            {"★".repeat(stars)}{"☆".repeat(5 - stars)}
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>{mentor.avg_rating.toFixed(1)}</span>
                          <span style={{ fontSize: 12, color: "#9ca3af" }}>({mentor.total_ratings}개 리뷰)</span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: "#9ca3af" }}>리뷰 없음</span>
                      )}
                      {mentor.response_rate > 0 && (
                        <span style={{ fontSize: 12, color: "#6b7280" }}>답변률 {mentor.response_rate.toFixed(0)}%</span>
                      )}
                    </div>

                    <p style={{ margin: "0 0 14px", fontSize: 13, color: "#6b7280", lineHeight: 1.6, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {mentor.intro || "소개글이 없습니다."}
                    </p>

                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <button
                        onClick={() => handleSubscribe(mentor)}
                        disabled={isMe || isPaying || paying !== null}
                        style={{
                          padding: "10px 22px", borderRadius: 12, border: "none",
                          background: isMe ? "#f3f4f6" : isPaying ? "#d1d5db" : "#111827",
                          color: isMe ? "#9ca3af" : "white",
                          fontWeight: 800, fontSize: 13,
                          cursor: isMe || isPaying || paying !== null ? "not-allowed" : "pointer",
                        }}
                      >
                        {isMe ? "본인 멘토" : isPaying ? "결제 중..." : "이 멘토로 수강하기"}
                      </button>
                      <Link
                        href={`/cad-school/mentor/${mentor.id}`}
                        style={{ fontSize: 12, color: "#6b7280", textDecoration: "none", border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 12px" }}
                      >
                        프로필 보기
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

function Avatar({ url, size }: { url?: string | null; size: number }) {
  return url ? (
    <img src={url} alt="avatar" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "1px solid #e5e7eb" }} />
  ) : (
    <div style={{ width: size, height: size, borderRadius: "50%", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.45, flexShrink: 0, color: "#9ca3af" }}>👤</div>
  );
}
