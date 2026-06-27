const CDN_URL = 'https://images.3d-jewelry-trade.com';
const OLD_R2_URL = 'https://pub-5964134090c64788ac087efbbd252f4c.r2.dev';
const OLD_SUPABASE_THUMB = 'https://fvhotaxjdacfulxjahon.supabase.co/storage/v1/object/public/thumbnails/';

export const getCdnImageUrl = (
  path: string | null | undefined,
  options?: { width?: number; height?: number; quality?: number }
): string => {
  if (!path) return '/placeholder.png';

  if (path.startsWith(CDN_URL)) return path;

  let cdnPath = path;
  if (path.startsWith(OLD_R2_URL)) {
    cdnPath = path.replace(OLD_R2_URL, CDN_URL);
  } else if (path.startsWith(OLD_SUPABASE_THUMB)) {
    cdnPath = `${CDN_URL}/${path.slice(OLD_SUPABASE_THUMB.length)}`;
  } else if (!path.startsWith('http')) {
    cdnPath = `${CDN_URL}/${path}`;
  }
  // Google OAuth 등 외부 URL은 변환 없이 그대로 반환

  if (options && cdnPath.startsWith(CDN_URL)) {
    const params = [
      options.width  ? `width=${options.width}`   : '',
      options.height ? `height=${options.height}` : '',
      options.quality ? `quality=${options.quality}` : 'quality=80',
      'format=webp',
    ].filter(Boolean).join(',');
    const urlPath = cdnPath.slice(CDN_URL.length + 1);
    return `${CDN_URL}/cdn-cgi/image/${params}/${urlPath}`;
  }

  return cdnPath;
};

// 썸네일용 (400×400, webp)
export const getThumbnailUrl = (path: string | null | undefined): string =>
  getCdnImageUrl(path, { width: 400, height: 400, quality: 80 });

// 갤러리/상세 이미지용 (800px, webp)
export const getGalleryUrl = (path: string | null | undefined): string =>
  getCdnImageUrl(path, { width: 800, quality: 85 });

// 프로필 아바타용 (100×100, webp)
export const getAvatarUrl = (path: string | null | undefined): string =>
  getCdnImageUrl(path, { width: 100, height: 100, quality: 80 });

// 모델 객체에서 썸네일 추출 (기존 로컬 getThumbnailUrl(item) 대체)
export const getModelThumbnailUrl = (item: {
  thumbnail?: string | null;
  thumbnail_path?: string | null;
}): string => getThumbnailUrl(item.thumbnail || item.thumbnail_path);
