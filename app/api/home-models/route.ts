import { NextResponse } from "next/server";

// 홈페이지 모델 목록 + 판매자 프로필 + 댓글 수를 서버에서 병렬로 모아 60초간 캐싱한다.
// 기존에는 클라이언트가 Supabase REST를 직접 3번 순차 호출(no-store)했던 부분을 대체.
export const revalidate = 60;

const MODELS_LIMIT = 48;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const authHeaders = {
  apikey: ANON_KEY,
  Authorization: `Bearer ${ANON_KEY}`,
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const offset = Math.max(0, Number(searchParams.get("offset")) || 0);

  const modelsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/models?select=id,title,description,price,thumbnail,thumbnail_path,file_url,model_file_path,seller_id,category,created_at,view_count,download_count&order=created_at.desc,id.desc&limit=${MODELS_LIMIT}&offset=${offset}`,
    { headers: authHeaders, next: { revalidate: 60 } }
  );
  const models = await modelsRes.json();

  if (!Array.isArray(models)) {
    return NextResponse.json({ models: [], hasMore: false });
  }

  const sellerIds = [...new Set(models.map((m: any) => m.seller_id).filter(Boolean))];
  const modelIds = models.map((m: any) => m.id).filter(Boolean);

  const [profiles, commentCounts] = await Promise.all([
    sellerIds.length > 0
      ? fetch(
          `${SUPABASE_URL}/rest/v1/profiles_public?select=id,nickname,grade&id=in.(${sellerIds.join(",")})`,
          { headers: authHeaders, next: { revalidate: 60 } }
        ).then((r) => r.json())
      : Promise.resolve([]),
    modelIds.length > 0
      ? fetch(`${SUPABASE_URL}/rest/v1/rpc/get_model_comment_counts`, {
          method: "POST",
          headers: { ...authHeaders, "Content-Type": "application/json" },
          body: JSON.stringify({ model_ids: modelIds }),
          next: { revalidate: 60 },
        }).then((r) => r.json())
      : Promise.resolve([]),
  ]);

  const profileMap: Record<string, { nickname: string; grade: string }> = {};
  if (Array.isArray(profiles)) {
    for (const p of profiles) profileMap[p.id] = { nickname: p.nickname, grade: p.grade };
  }

  const commentCountMap: Record<string, number> = {};
  if (Array.isArray(commentCounts)) {
    for (const c of commentCounts) commentCountMap[c.model_id] = Number(c.comment_count) || 0;
  }

  const mapped = models.map((m: any) => ({
    ...m,
    seller_nickname: profileMap[m.seller_id]?.nickname ?? null,
    seller_grade: profileMap[m.seller_id]?.grade ?? null,
    comment_count: commentCountMap[m.id] || 0,
  }));

  return NextResponse.json({ models: mapped, hasMore: models.length === MODELS_LIMIT });
}
