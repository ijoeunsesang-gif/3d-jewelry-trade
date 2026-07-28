import { getCdnImageUrl, getModelThumbnailUrl, getGalleryUrl } from "@/lib/imageUrl";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const authHeaders = {
  apikey: ANON_KEY,
  Authorization: `Bearer ${ANON_KEY}`,
};

const GALLERY_IMAGES_LIMIT = 10;

export type ModelDetailItem = {
  id: string;
  title: string;
  description: string;
  price: number;
  thumbnail: string;
  thumbnail_path?: string | null;
  file_url: string;
  model_file_path?: string | null;
  seller_id: string;
  category: string;
  created_at: string;
  view_count?: number;
  download_count?: number;
};

export type ModelDetailBatch = {
  model: ModelDetailItem;
  galleryImages: string[];
};

// 모델 상세 페이지의 "공개" 데이터(모델 row + 갤러리 이미지)를 서버에서 가져온다.
// model_images.model_id → models.id FK가 스키마에 걸려 있어(확인 완료) PostgREST embedding으로
// 왕복 1회에 합칠 수 있다 — 예전엔 모델 row / 갤러리 이미지를 별도 요청 2개로 병렬 조회했음.
// 찜/구매/장바구니처럼 로그인 유저별로 달라지는 데이터는 여기서 다루지 않는다 —
// 서버는 항상 비로그인 기준으로 렌더하고, ModelDetailClient가 마운트 후 기존과
// 동일하게 클라이언트에서 조회해 채운다(홈 SSR 전환 때의 찜 처리와 동일한 원리).
export async function getModelDetailBatch(id: string): Promise<ModelDetailBatch | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/models?id=eq.${id}&select=*,model_images(image_url,image_path,sort_order)` +
      `&model_images.order=sort_order.asc&model_images.limit=${GALLERY_IMAGES_LIMIT}`,
    { headers: authHeaders, next: { revalidate: 60 } }
  );

  const rows = await res.json();
  const row = Array.isArray(rows) ? rows[0] ?? null : null;

  if (!row) {
    return null;
  }

  const { model_images: imageRows, ...model } = row as ModelDetailItem & {
    model_images: { image_url?: string | null; image_path?: string | null; sort_order?: number }[];
  };

  const baseThumb = getModelThumbnailUrl(model);
  const urls: string[] = [];
  if (baseThumb) urls.push(baseThumb);

  if (Array.isArray(imageRows)) {
    for (const imgRow of imageRows) {
      let url = imgRow.image_url ? getCdnImageUrl(imgRow.image_url) : "";
      if (!url && imgRow.image_path) {
        url = getGalleryUrl(imgRow.image_path);
      }
      if (url && !urls.includes(url)) {
        urls.push(url);
      }
    }
  }

  return { model, galleryImages: urls };
}
