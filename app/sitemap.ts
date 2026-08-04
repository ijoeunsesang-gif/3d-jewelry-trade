import type { MetadataRoute } from "next";

const BASE_URL = "https://www.3d-jewelry-trade.com";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const authHeaders = {
  apikey: ANON_KEY,
  Authorization: `Bearer ${ANON_KEY}`,
};

// 검색엔진에 과도한 URL을 넘기지 않도록 최신순으로 상한선을 둔다.
const MODELS_LIMIT = 5000;
const NOTICES_LIMIT = 500;

export const revalidate = 3600;

const STATIC_PAGES: { path: string; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]; priority: number }[] = [
  { path: "", changeFrequency: "daily", priority: 1.0 },
  { path: "/partner", changeFrequency: "monthly", priority: 0.6 },
  { path: "/customer-service", changeFrequency: "monthly", priority: 0.5 },
  { path: "/help", changeFrequency: "monthly", priority: 0.5 },
  { path: "/notice", changeFrequency: "daily", priority: 0.5 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.2 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.2 },
  { path: "/refund", changeFrequency: "yearly", priority: 0.2 },
];

type ModelRow = { id: string; seller_id: string | null; created_at: string };
type NoticeRow = { id: string; created_at: string | null };

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = STATIC_PAGES.map((p) => ({
    url: `${BASE_URL}${p.path}`,
    lastModified: now,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));

  const [models, notices] = await Promise.all([
    fetch(
      `${SUPABASE_URL}/rest/v1/models?select=id,seller_id,created_at&order=created_at.desc&limit=${MODELS_LIMIT}`,
      { headers: authHeaders, next: { revalidate: 3600 } }
    )
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []) as Promise<ModelRow[]>,
    fetch(
      `${SUPABASE_URL}/rest/v1/notices?select=id,created_at&order=created_at.desc&limit=${NOTICES_LIMIT}`,
      { headers: authHeaders, next: { revalidate: 3600 } }
    )
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []) as Promise<NoticeRow[]>,
  ]);

  const modelPages: MetadataRoute.Sitemap = Array.isArray(models)
    ? models.map((m) => ({
        url: `${BASE_URL}/models/${m.id}`,
        lastModified: m.created_at ? new Date(m.created_at) : now,
        changeFrequency: "weekly",
        priority: 0.8,
      }))
    : [];

  // 모델을 하나 이상 올린 판매자만 프로필 페이지를 노출한다(빈 프로필 방지).
  const sellerIds = Array.isArray(models)
    ? [...new Set(models.map((m) => m.seller_id).filter((v): v is string => !!v))]
    : [];

  const sellerPages: MetadataRoute.Sitemap = sellerIds.map((id) => ({
    url: `${BASE_URL}/seller/${id}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  const noticePages: MetadataRoute.Sitemap = Array.isArray(notices)
    ? notices.map((n) => ({
        url: `${BASE_URL}/notice/${n.id}`,
        lastModified: n.created_at ? new Date(n.created_at) : now,
        changeFrequency: "monthly",
        priority: 0.3,
      }))
    : [];

  return [...staticPages, ...modelPages, ...sellerPages, ...noticePages];
}
