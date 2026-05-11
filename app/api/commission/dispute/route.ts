import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAdminUser } from "@/lib/isAdminCheck";

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const VALID_REASONS = ["기간초과", "결과물불량", "수정요청미응답", "기타"];

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

  const { data: { user }, error: authErr } = await serviceSupabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "인증 실패" }, { status: 401 });

  let body: { commission_id?: string; reason?: string; detail?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "잘못된 요청" }, { status: 400 }); }

  const { commission_id, reason, detail } = body;
  if (!commission_id || !reason || !VALID_REASONS.includes(reason)) {
    return NextResponse.json({ error: "commission_id와 유효한 reason이 필요합니다." }, { status: 400 });
  }

  const { data: commission, error: fetchErr } = await serviceSupabase
    .from("commissions")
    .select("id, user_id, status, title")
    .eq("id", commission_id)
    .single();

  if (fetchErr || !commission) return NextResponse.json({ error: "의뢰를 찾을 수 없습니다." }, { status: 404 });
  if (commission.user_id !== user.id) return NextResponse.json({ error: "신고 권한이 없습니다." }, { status: 403 });
  const DISPUTABLE_STATUSES = ["working", "completed", "downloaded", "작업중", "작업완료", "다운로드완료"];
  if (!DISPUTABLE_STATUSES.includes(commission.status)) return NextResponse.json({ error: "작업중/작업완료/다운로드완료 상태에서만 신고할 수 있습니다." }, { status: 400 });

  const { data: dispute, error: insertErr } = await serviceSupabase
    .from("commission_disputes")
    .insert({ commission_id, reporter_id: user.id, reason, detail: detail || null, status: "접수" })
    .select("id")
    .single();

  if (insertErr) {
    console.error("[dispute] insert error:", insertErr);
    return NextResponse.json({ error: "신고 접수 실패" }, { status: 500 });
  }

  const adminEmail = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || "").trim().toLowerCase();
  if (adminEmail) {
    try {
      const { data: { users } } = await serviceSupabase.auth.admin.listUsers();
      const adminUser = users.find((u) => u.email?.toLowerCase() === adminEmail);
      if (adminUser) {
        await serviceSupabase.from("notifications").insert({
          user_id: adminUser.id,
          type: "negotiation",
          title: `[개인의뢰] ${commission.title} - 문제 신고가 접수되었습니다.`,
          link: `/commission/${commission_id}`,
          is_read: false,
        });
      }
    } catch (e) {
      console.error("[dispute] admin notify error:", e);
    }
  }

  return NextResponse.json({ success: true, dispute_id: dispute.id });
}

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

  const { data: { user }, error: authErr } = await serviceSupabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "인증 실패" }, { status: 401 });

  const isAdmin = await isAdminUser(serviceSupabase, user.id);

  const commission_id = req.nextUrl.searchParams.get("commission_id");
  if (!commission_id) return NextResponse.json({ error: "commission_id가 필요합니다." }, { status: 400 });

  const { data: commission } = await serviceSupabase
    .from("commissions")
    .select("user_id")
    .eq("id", commission_id)
    .single();

  if (!commission) return NextResponse.json({ error: "의뢰를 찾을 수 없습니다." }, { status: 404 });

  const isAuthor = commission.user_id === user.id;
  if (!isAdmin && !isAuthor) return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });

  let query = serviceSupabase
    .from("commission_disputes")
    .select("id, commission_id, reporter_id, reason, detail, status, created_at")
    .eq("commission_id", commission_id)
    .order("created_at", { ascending: false });

  if (!isAdmin) {
    query = query.eq("reporter_id", user.id);
  }

  const { data: disputes, error } = await query;

  if (error) return NextResponse.json({ error: "조회 실패" }, { status: 500 });

  return NextResponse.json({ disputes: disputes || [] });
}
