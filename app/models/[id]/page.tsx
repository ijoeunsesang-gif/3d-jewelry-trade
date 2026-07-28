import ModelDetailClient from "./ModelDetailClient";
import { getModelDetailBatch } from "@/app/lib/getModelDetailBatch";

// 모델 row + 갤러리 이미지(둘 다 공개 데이터)를 서버에서 가져와 렌더한다.
// 찜/구매/장바구니 등 로그인 유저별 상태는 서버에서 다루지 않고 ModelDetailClient가
// 마운트 후 기존과 동일하게 클라이언트에서 조회한다.
export default async function ModelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let data: Awaited<ReturnType<typeof getModelDetailBatch>> = null;
  try {
    data = await getModelDetailBatch(id);
  } catch (e) {
    console.error("[ModelDetailPage] 서버 조회 실패:", e);
  }

  if (!data) {
    return (
      <main style={{ maxWidth: 900, margin: "60px auto", padding: "0 20px" }}>
        <p>모델을 찾을 수 없습니다.</p>
      </main>
    );
  }

  return <ModelDetailClient initialModel={data.model} initialGalleryImages={data.galleryImages} />;
}
