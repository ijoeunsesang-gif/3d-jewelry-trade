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

// GET: list deleted conversations
export async function GET(req: NextRequest) {
  if (!(await verifyAdmin(req))) {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }

  const { data: convs, error } = await adminSupabase
    .from("conversations")
    .select("id, user1_id, user2_id, deleted_by_user1, deleted_by_user2, updated_at")
    .or("deleted_by_user1.eq.true,deleted_by_user2.eq.true")
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!convs || convs.length === 0) return NextResponse.json({ data: [] });

  const allIds = [...new Set([
    ...convs.map((c: any) => c.user1_id),
    ...convs.map((c: any) => c.user2_id),
  ])];

  const { data: profiles } = await adminSupabase
    .from("profiles")
    .select("id, nickname, email")
    .in("id", allIds);

  const pm: Record<string, { nickname: string; email: string }> = {};
  (profiles || []).forEach((p: any) => {
    pm[p.id] = { nickname: p.nickname || "익명", email: p.email || "" };
  });

  const data = convs.map((c: any) => ({
    ...c,
    user1_nickname: pm[c.user1_id]?.nickname || "알 수 없음",
    user1_email:    pm[c.user1_id]?.email    || "",
    user2_nickname: pm[c.user2_id]?.nickname || "알 수 없음",
    user2_email:    pm[c.user2_id]?.email    || "",
  }));

  return NextResponse.json({ data });
}

// POST: get messages for a specific conversation
export async function POST(req: NextRequest) {
  if (!(await verifyAdmin(req))) {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }

  const { conversationId } = await req.json();
  if (!conversationId) return NextResponse.json({ error: "conversationId 필요" }, { status: 400 });

  const { data: messages, error } = await adminSupabase
    .from("messages")
    .select("id, sender_id, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get sender nicknames
  const senderIds = [...new Set((messages || []).map((m: any) => m.sender_id))];
  const { data: profiles } = await adminSupabase
    .from("profiles")
    .select("id, nickname")
    .in("id", senderIds);

  const pm: Record<string, string> = {};
  (profiles || []).forEach((p: any) => { pm[p.id] = p.nickname || "익명"; });

  const data = (messages || []).map((m: any) => ({
    ...m,
    sender_nickname: pm[m.sender_id] || "알 수 없음",
  }));

  return NextResponse.json({ data });
}
