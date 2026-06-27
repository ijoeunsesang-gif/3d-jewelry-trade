const CDN_URL = 'https://images.3d-jewelry-trade.com';
const OLD_R2_URL = 'https://pub-5964134090c64788ac087efbbd252f4c.r2.dev';

export const getCdnImageUrl = (path: string | null | undefined): string => {
  if (!path) return '/placeholder.png';
  console.log('[imageUrl] input:', path);
  let result: string;
  if (path.startsWith('data:') || path.startsWith('/')) {
    result = path;
  } else if (path.startsWith(OLD_R2_URL)) {
    result = path.replace(OLD_R2_URL, CDN_URL);
  } else if (path.startsWith('http') && !path.startsWith(CDN_URL)) {
    result = path;
  } else if (!path.startsWith('http')) {
    result = `${CDN_URL}/${path}`;
  } else {
    result = path;
  }
  console.log('[imageUrl] output:', result);
  return result;
};

export const getThumbnailUrl = getCdnImageUrl;
export const getGalleryUrl = getCdnImageUrl;
export const getAvatarUrl = getCdnImageUrl;
export const getModelThumbnailUrl = (model: any) =>
  getCdnImageUrl(model?.thumbnail || model?.thumbnail_path);
