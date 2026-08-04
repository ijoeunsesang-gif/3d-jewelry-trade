import type { Metadata } from "next";
import ModelDetailClient from "./ModelDetailClient";
import { getModelDetailBatch } from "@/app/lib/getModelDetailBatch";
import { getModelThumbnailUrl } from "@/lib/imageUrl";

// generateMetadata와 페이지 컴포넌트가 같은 fetch(getModelDetailBatch)를 호출하지만,
// Next.js가 동일 요청 내에서 동일한 fetch 호출을 자동으로 메모이즈하므로 네트워크 왕복은 1회다.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  let data: Awaited<ReturnType<typeof getModelDetailBatch>> = null;
  try {
    data = await getModelDetailBatch(id);
  } catch {
    // noop — 아래 fallback으로 처리
  }

  if (!data) {
    return { title: "모델을 찾을 수 없습니다" };
  }

  const { model } = data;
  const title = model.title;
  const description = model.description
    ? model.description.slice(0, 160)
    : `${model.category} 3D 모델 - ${model.price.toLocaleString("ko-KR")}원`;
  const image = getModelThumbnailUrl(model);

  return {
    title,
    description,
    openGraph: {
      type: "website",
      title,
      description,
      images: [{ url: image }],
    },
  };
}

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
