import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const nowIso = new Date().toISOString();

  const { data: popups, error } = await adminSupabase
    .from("popup_notices")
    .select("id, title, content, image_url, link_url")
    .eq("is_active", true)
    .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
    .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "조회 실패: " + error.message }, { status: 500 });
  }

  return NextResponse.json({ popups: popups || [] });
}
