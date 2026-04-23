/**
 * R2 버킷 CORS 설정 스크립트
 * 실행: node scripts/set-r2-cors.mjs
 */

import { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } from "@aws-sdk/client-s3";
import { readFileSync } from "fs";

const envFile = readFileSync(".env.local", "utf-8");
const env = Object.fromEntries(
  envFile.split("\n")
    .filter((l) => l.trim() && !l.startsWith("#"))
    .map((l) => { const idx = l.indexOf("="); return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()]; })
    .filter(([k]) => k)
);

const r2 = new S3Client({
  region: "auto",
  endpoint: env.R2_ENDPOINT,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

const corsConfig = {
  CORSRules: [
    {
      AllowedOrigins: ["*"],
      AllowedMethods: ["GET", "HEAD"],
      AllowedHeaders: ["*"],
      ExposeHeaders: ["Content-Length", "Content-Type", "ETag"],
      MaxAgeSeconds: 3600,
    },
  ],
};

async function setCors(bucket) {
  try {
    await r2.send(new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: corsConfig,
    }));

    // 확인
    const { CORSRules } = await r2.send(new GetBucketCorsCommand({ Bucket: bucket }));
    console.log(`✓ ${bucket} CORS 설정 완료:`, JSON.stringify(CORSRules, null, 2));
  } catch (e) {
    console.error(`✗ ${bucket} CORS 설정 실패:`, e.message);
  }
}

(async () => {
  console.log("🔧 R2 CORS 설정 중...\n");
  await setCors("thumbnails");
  await setCors("models-private");
  console.log("\n✅ 완료");
})();
