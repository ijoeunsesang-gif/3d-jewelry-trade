import { NextResponse } from "next/server";
import { getHomeModelsBatch } from "@/app/lib/getHomeModelsBatch";

// 홈페이지 첫 배치는 app/page.tsx가 getHomeModelsBatch()를 직접 호출해 서버 렌더한다.
// 이 라우트는 48개 이후 "더보기" 배치를 클라이언트가 계속 불러오기 위해 유지한다.
export const revalidate = 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const offset = Math.max(0, Number(searchParams.get("offset")) || 0);

  const { models, hasMore } = await getHomeModelsBatch(offset);

  return NextResponse.json({ models, hasMore });
}
