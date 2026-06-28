import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

  const { data: { user }, error: authErr } = await adminSupabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "인증 실패" }, { status: 401 });

  const { category, name, contact, address, description } = await req.json();

  if (!category?.trim()) return NextResponse.json({ error: "업체 분류를 선택하세요." }, { status: 400 });
  if (!name?.trim())     return NextResponse.json({ error: "업체명을 입력하세요." }, { status: 400 });
  if (!contact?.trim())  return NextResponse.json({ error: "연락처를 입력하세요." }, { status: 400 });
  if (!address?.trim())  return NextResponse.json({ error: "주소를 입력하세요." }, { status: 400 });
  if (!description?.trim()) return NextResponse.json({ error: "상세내용을 입력하세요." }, { status: 400 });

  // 동일 유저의 대기중(pending) 신청이 있으면 중복 차단
  const { data: existing } = await adminSupabase
    .from("partner_requests")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "이미 신청 중인 내용이 있습니다. 처리 완료 후 재신청해 주세요." }, { status: 409 });
  }

  const { error: insertErr } = await adminSupabase
    .from("partner_requests")
    .insert({
      user_id: user.id,
      user_email: user.email || "",
      category: category.trim(),
      name: name.trim(),
      contact: contact.trim(),
      address: address.trim(),
      description: description.trim(),
      status: "pending",
    });

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  // 관리자 알림
  const { data: admins } = await adminSupabase
    .from("profiles")
    .select("id")
    .eq("role", "admin");

  if (admins && admins.length > 0) {
    await adminSupabase.from("notifications").insert(
      admins.map((a: { id: string }) => ({
        user_id: a.id,
        type: "inquiry",
        title: `새로운 업체등록 신청이 접수되었습니다: ${name.trim()}`,
        link: "/admin",
        is_read: false,
      }))
    );
  }

  return NextResponse.json({ success: true });
}
