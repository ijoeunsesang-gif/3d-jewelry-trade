/**
 * R2 thumbnails 버킷 CORS 설정 스크립트
 * 실행: npx tsx scripts/set-r2-cors.ts
 * (환경변수: R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)
 */
import { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } from "@aws-sdk/client-s3";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});

const BUCKET = "thumbnails";

const CORS_RULES = {
  CORSRules: [
    {
      AllowedOrigins: [
        "https://www.3d-jewelry-trade.com",
        "https://3d-jewelry-trade.com",
        "https://3d-jewelry-trade.vercel.app",
        "http://localhost:3000",
      ],
      AllowedMethods: ["GET"],
      AllowedHeaders: ["*"],
      MaxAgeSeconds: 3600,
    },
  ],
};

async function main() {
  // 현재 CORS 설정 확인
  try {
    const current = await r2.send(new GetBucketCorsCommand({ Bucket: BUCKET }));
    console.log("현재 CORS 설정:", JSON.stringify(current.CORSRules, null, 2));
  } catch {
    console.log("현재 CORS 설정 없음");
  }

  // CORS 설정 적용
  await r2.send(new PutBucketCorsCommand({ Bucket: BUCKET, CORSConfiguration: CORS_RULES }));
  console.log(`✓ ${BUCKET} 버킷 CORS 설정 완료`);
  console.log(JSON.stringify(CORS_RULES, null, 2));
}

main().catch((e) => {
  console.error("CORS 설정 실패:", e.message);
  process.exit(1);
});
