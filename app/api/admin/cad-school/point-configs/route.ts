import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function requireAdmin(token: string): Promise<string | null> {
  const { data: { user } } = await adminSupabase.auth.getUser(token);
  if (!user) return null;
  const { data } = await adminSupabase.from("profiles").select("role").eq("id", user.id).single();
  return data?.role === "admin" ? user.id : null;
}

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  if (!(await requireAdmin(token))) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const { data, error } = await adminSupabase
    .from("cad_point_configs")
    .select("key, value, description, updated_at")
    .order("key");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ configs: data ?? [] });
}

export async function PATCH(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  if (!(await requireAdmin(token))) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  try {
    const { key, value } = await req.json();
    if (!key || typeof value !== "number" || value < 0) {
      return NextResponse.json({ error: "올바른 키와 포인트 값을 입력해주세요." }, { status: 400 });
    }

    const { error } = await adminSupabase
      .from("cad_point_configs")
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "오류 발생" }, { status: 500 });
  }
}
