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

export async function PATCH(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });

  const { data: seller, error: fetchErr } = await adminSupabase
    .from("profiles")
    .select("id, nickname, business_registration_url, is_business_verified")
    .eq("id", id)
    .single();

  if (fetchErr || !seller) {
    return NextResponse.json({ error: "판매자를 찾을 수 없습니다." }, { status: 404 });
  }
  if (!seller.business_registration_url) {
    return NextResponse.json({ error: "등록된 사업자등록증이 없습니다." }, { status: 400 });
  }
  if (seller.is_business_verified) {
    return NextResponse.json({ error: "이미 승인된 판매자입니다." }, { status: 409 });
  }

  const { error: updateErr } = await adminSupabase
    .from("profiles")
    .update({ is_business_verified: true })
    .eq("id", id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  await adminSupabase.from("notifications").insert({
    user_id: id,
    type: "system",
    title: "사업자 정보가 승인되어 세금계산서 발행이 가능합니다.",
    link: "/profile?tab=seller",
    is_read: false,
  });

  return NextResponse.json({ success: true });
}
