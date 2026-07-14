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

export async function GET(req: NextRequest) {
  if (!(await verifyAdmin(req))) {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }

  const [profilesRes, authRes] = await Promise.all([
    adminSupabase
      .from("profiles")
      .select("id, nickname, email, role, created_at, points, is_point_blocked, warning_count, deleted_at, last_active_at")
      .order("created_at", { ascending: false }),
    adminSupabase.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  if (profilesRes.error) return NextResponse.json({ error: profilesRes.error.message }, { status: 500 });

  const authMap = new Map(
    (authRes.data?.users ?? []).map((u) => [u.id, { created_at: u.created_at, last_sign_in_at: u.last_sign_in_at }])
  );

  // last_sign_in_at(실제 로그인 그랜트)과 last_active_at(자동로그인 세션 복원 포함) 중 더 최근 값 사용
  const merged = (profilesRes.data ?? []).map((u: any) => {
    const authLogin = authMap.get(u.id)?.last_sign_in_at ?? null;
    const activeAt = u.last_active_at ?? null;
    const latestMs = Math.max(
      authLogin ? new Date(authLogin).getTime() : 0,
      activeAt ? new Date(activeAt).getTime() : 0
    );

    return {
      ...u,
      created_at: authMap.get(u.id)?.created_at ?? u.created_at ?? null,
      last_sign_in_at: latestMs > 0 ? new Date(latestMs).toISOString() : null,
    };
  });

  return NextResponse.json({ data: merged });
}

// 관리자가 수정 가능한 필드만 허용 (role 변경 등 민감 필드 차단)
const ALLOWED_UPDATE_FIELDS = new Set([
  "is_point_blocked",
  "warning_count",
  "is_seller_banned",
  "points",
  "nickname",
]);

export async function PATCH(req: NextRequest) {
  if (!(await verifyAdmin(req))) {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }

  const { userId, updates } = await req.json();
  if (!userId || !updates || typeof updates !== "object") {
    return NextResponse.json({ error: "userId, updates 필요" }, { status: 400 });
  }

  // 허용되지 않은 필드 차단
  const invalidFields = Object.keys(updates).filter((k) => !ALLOWED_UPDATE_FIELDS.has(k));
  if (invalidFields.length > 0) {
    return NextResponse.json(
      { error: `수정 불가 필드: ${invalidFields.join(", ")}` },
      { status: 400 }
    );
  }

  const { error } = await adminSupabase
    .from("profiles")
    .update(updates)
    .eq("id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
