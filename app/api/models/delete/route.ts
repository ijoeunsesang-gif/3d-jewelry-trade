import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { r2DeleteMany } from "@/lib/r2";
import { isAdminUser } from "@/lib/isAdminCheck";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function DELETE(req: NextRequest) {
  const modelId = req.nextUrl.searchParams.get("id");
  if (!modelId) {
    return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
  }

  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const { data: { user }, error: authError } = await adminSupabase.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "인증 실패" }, { status: 401 });
  }

  const { data: model, error: fetchError } = await adminSupabase
    .from("models")
    .select("id, seller_id, thumbnail_path, model_file_path")
    .eq("id", modelId)
    .single();

  if (fetchError || !model) {
    return NextResponse.json({ error: "모델을 찾을 수 없습니다." }, { status: 404 });
  }

  const isAdmin = await isAdminUser(adminSupabase, user.id);
  if (!isAdmin && model.seller_id !== user.id) {
    return NextResponse.json({ error: "삭제 권한이 없습니다." }, { status: 403 });
  }

  // 관련 파일 경로 수집 (삭제 전에 조회해야 함)
  const [{ data: images }, { data: extraFiles }] = await Promise.all([
    adminSupabase.from("model_images").select("image_path").eq("model_id", modelId),
    adminSupabase.from("model_files").select("file_path").eq("model_id", modelId),
  ]);

  const r2Paths: { bucket: string; key: string }[] = [];
  if (model.thumbnail_path) r2Paths.push({ bucket: "thumbnails", key: model.thumbnail_path });
  if (model.model_file_path) r2Paths.push({ bucket: "models-private", key: model.model_file_path });
  (images || []).forEach((img) => { if (img.image_path) r2Paths.push({ bucket: "thumbnails", key: img.image_path }); });
  (extraFiles || []).forEach((f) => { if (f.file_path) r2Paths.push({ bucket: "models-private", key: f.file_path }); });

  // 1. conversations 먼저 삭제 (models에 FK 걸려 있어 가장 먼저 처리)
  const { data: convRows } = await adminSupabase
    .from("conversations")
    .select("id")
    .eq("model_id", modelId);
  const convIds = (convRows || []).map((r: { id: string }) => r.id);
  if (convIds.length > 0) {
    await adminSupabase.from("messages").delete().in("conversation_id", convIds);
  }
  await adminSupabase.from("conversations").delete().eq("model_id", modelId);

  // 2. 나머지 FK 제약 테이블 삭제
  await adminSupabase.from("model_images").delete().eq("model_id", modelId);
  await adminSupabase.from("model_files").delete().eq("model_id", modelId);
  await adminSupabase.from("purchases").delete().eq("model_id", modelId);

  // 3. models 행 삭제
  const { error: deleteError } = await adminSupabase
    .from("models")
    .delete()
    .eq("id", modelId);

  if (deleteError) {
    console.error("models 삭제 실패:", deleteError);
    return NextResponse.json(
      { error: "모델 삭제 실패: " + deleteError.message },
      { status: 500 }
    );
  }

  // 3. R2 파일 삭제 — 실패해도 응답에 영향 없음
  r2DeleteMany(r2Paths).catch((e) => console.error("R2 파일 삭제 오류 (무시):", e));

  return NextResponse.json({ success: true });
}
