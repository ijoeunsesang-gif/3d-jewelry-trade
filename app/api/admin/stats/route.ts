import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAdminUser } from "@/lib/isAdminCheck";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const { data: { user }, error } = await adminSupabase.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "인증 실패" }, { status: 401 });
  if (!(await isAdminUser(adminSupabase, user.id))) {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }

  const [
    { data: purchases },
    { data: models },
    { data: newUsers },
    { data: sellerProfiles },
  ] = await Promise.all([
    adminSupabase
      .from("purchases")
      .select("id, model_id, price, created_at")
      .order("created_at", { ascending: false }),
    adminSupabase
      .from("models")
      .select("id, title, seller_id"),
    adminSupabase
      .from("profiles")
      .select("id, created_at")
      .order("created_at", { ascending: false }),
    adminSupabase
      .from("profiles")
      .select("id, nickname")
      .eq("role", "seller"),
  ]);

  return NextResponse.json({
    purchases: purchases || [],
    models: models || [],
    newUsers: newUsers || [],
    sellerProfiles: sellerProfiles || [],
  });
}
