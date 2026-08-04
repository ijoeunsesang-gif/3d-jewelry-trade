import type { MetadataRoute } from "next";

const BASE_URL = "https://www.3d-jewelry-trade.com";

// 로그인/결제/관리자 등 비공개 경로 — 검색엔진에 노출할 필요가 없다.
const DISALLOW_PATHS = [
  "/admin",
  "/api/",
  "/auth/",
  "/cart",
  "/checkout",
  "/payment",
  "/profile",
  "/my/",
  "/my-models",
  "/messages",
  "/notifications",
  "/favorites",
  "/library",
  "/sales",
  "/upload",
  "/edit-model/",
  "/send-to-printer",
];

// Cloudflare가 자동 생성하던 robots.txt와 동일하게, 검색엔진은 허용하고
// 학습용 AI 크롤러는 차단하는 정책을 origin(Next.js) 쪽에서 유지한다.
const AI_CRAWLERS = [
  "GPTBot",
  "ChatGPT-User",
  "Google-Extended",
  "CCBot",
  "anthropic-ai",
  "ClaudeBot",
  "PerplexityBot",
  "Bytespider",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: DISALLOW_PATHS,
      },
      ...AI_CRAWLERS.map((userAgent) => ({
        userAgent,
        disallow: "/",
      })),
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
