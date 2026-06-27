const CDN_URL = 'https://images.3d-jewelry-trade.com';
const OLD_R2_URL = 'https://pub-5964134090c64788ac087efbbd252f4c.r2.dev';

export const getCdnImageUrl = (path: string | null | undefined): string => {
  if (!path) return '/placeholder.png';
  if (path.startsWith('data:') || path.startsWith('/')) return path;
  if (path.startsWith(OLD_R2_URL)) return path.replace(OLD_R2_URL, CDN_URL);
  if (path.startsWith('http') && !path.startsWith(CDN_URL)) return path;
  if (!path.startsWith('http')) return `${CDN_URL}/${path}`;
  return path;
};

export const getThumbnailUrl = getCdnImageUrl;
export const getGalleryUrl = getCdnImageUrl;
export const getAvatarUrl = getCdnImageUrl;
export const getModelThumbnailUrl = (model: any) =>
  getCdnImageUrl(model?.thumbnail || model?.thumbnail_path);
