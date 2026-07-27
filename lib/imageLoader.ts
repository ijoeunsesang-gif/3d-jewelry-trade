// Cloudflare Image Resizing 커스텀 로더
// images.3d-jewelry-trade.com이 Cloudflare 존에 물려 있을 때만 /cdn-cgi/image/ 변환이 동작한다.
// 해당 존에서 Image Resizing 기능이 켜져 있는지 배포 전에는 확신할 수 없으므로,
// NEXT_PUBLIC_CF_IMAGE_RESIZE_ENABLED=true 로 명시적으로 켜기 전까지는 원본 URL을 그대로 반환한다
// (= 기존 unoptimized:true와 동일한 동작이라 안전하게 기본값으로 둘 수 있음).
const CDN_ORIGIN = "https://images.3d-jewelry-trade.com";
const RESIZE_ENABLED = process.env.NEXT_PUBLIC_CF_IMAGE_RESIZE_ENABLED === "true";

type LoaderParams = {
  src: string;
  width: number;
  quality?: number;
};

export default function cloudflareImageLoader({ src, width, quality }: LoaderParams): string {
  // 우리 CDN 도메인이 아닌 이미지(R2 직링크, 구글/카카오 아바타, supabase storage 등)는
  // Cloudflare Image Resizing 대상이 아니므로 원본 그대로 통과시킨다.
  if (!RESIZE_ENABLED || !src.startsWith(CDN_ORIGIN)) {
    return src;
  }

  const path = src.slice(CDN_ORIGIN.length); // '/'로 시작하는 경로
  const params = [`width=${width}`, `quality=${quality || 75}`, "format=auto"].join(",");
  return `${CDN_ORIGIN}/cdn-cgi/image/${params}${path}`;
}
