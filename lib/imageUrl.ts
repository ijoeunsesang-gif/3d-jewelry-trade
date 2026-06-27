const CDN_URL = 'https://images.3d-jewelry-trade.com';
const OLD_R2_URL = 'https://pub-5964134090c64788ac087efbbd252f4c.r2.dev';

export const getCdnImageUrl = (path: string | null | undefined): string => {
  if (!path) return '/placeholder.png';
  if (path.startsWith('data:') || path.startsWith('/')) return path;
  // 외부 URL (Google, Kakao OAuth 등) 그대로 통과
  if (path.startsWith('http') && !path.startsWith(OLD_R2_URL) && !path.startsWith(CDN_URL)) return path;
  // 구 R2 URL → CDN URL
  if (path.startsWith(OLD_R2_URL)) return path.replace(OLD_R2_URL, CDN_URL);
  // 이미 CDN URL
  if (path.startsWith(CDN_URL)) return path;
  // 파일명만 있거나 상대경로 → CDN URL 붙이기
  return `${CDN_URL}/${path}`;
};

export const getThumbnailUrl = getCdnImageUrl;
export const getGalleryUrl = getCdnImageUrl;
export const getAvatarUrl = getCdnImageUrl;
export const getModelThumbnailUrl = (model: any) =>
  getCdnImageUrl(model?.thumbnail || model?.thumbnail_path);
