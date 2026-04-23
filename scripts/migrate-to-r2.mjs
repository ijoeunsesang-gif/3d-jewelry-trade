/**
 * Supabase Storage → Cloudflare R2 마이그레이션 스크립트
 * 실행: node scripts/migrate-to-r2.mjs
 *
 * .env.local 값을 읽어서 동작합니다.
 * 실행 전: npm install @aws-sdk/client-s3 dotenv (이미 설치됨)
 */

import { S3Client, PutObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

// .env.local 수동 파싱
const envFile = readFileSync(".env.local", "utf-8");
const env = Object.fromEntries(
  envFile.split("\n")
    .filter((l) => l.trim() && !l.startsWith("#"))
    .map((l) => l.split("=").map((s) => s.trim()))
    .filter(([k]) => k)
    .map(([k, ...v]) => [k, v.join("=")])
);

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const R2_ENDPOINT = env.R2_ENDPOINT;
const R2_ACCESS_KEY_ID = env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = env.R2_SECRET_ACCESS_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const r2 = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

async function migrateFile(supabaseBucket, r2Bucket, path) {
  try {
    const { data, error } = await supabase.storage.from(supabaseBucket).download(path);
    if (error || !data) {
      console.error(`  ✗ 다운로드 실패: ${path} —`, error?.message);
      return false;
    }
    const buffer = Buffer.from(await data.arrayBuffer());
    await r2.send(new PutObjectCommand({
      Bucket: r2Bucket,
      Key: path,
      Body: buffer,
      ContentType: data.type || "application/octet-stream",
    }));
    console.log(`  ✓ ${path}`);
    return true;
  } catch (e) {
    console.error(`  ✗ 오류: ${path} —`, e.message);
    return false;
  }
}

async function listAllFiles(bucket, prefix = "") {
  const paths = [];
  let cursor;
  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit: 1000,
      offset: cursor ? undefined : 0,
    });
    if (error || !data) break;
    for (const item of data) {
      if (item.id) {
        paths.push(prefix ? `${prefix}/${item.name}` : item.name);
      } else {
        // 폴더 — 재귀
        const sub = await listAllFiles(bucket, prefix ? `${prefix}/${item.name}` : item.name);
        paths.push(...sub);
      }
    }
    if (data.length < 1000) break;
  }
  return paths;
}

async function migrateBucket(supabaseBucket, r2Bucket) {
  console.log(`\n📦 ${supabaseBucket} → ${r2Bucket} 마이그레이션 시작`);
  const paths = await listAllFiles(supabaseBucket);
  console.log(`  총 ${paths.length}개 파일 발견`);
  let ok = 0, fail = 0;
  for (const path of paths) {
    const success = await migrateFile(supabaseBucket, r2Bucket, path);
    success ? ok++ : fail++;
  }
  console.log(`  완료: ✓ ${ok}개, ✗ ${fail}개`);
}

(async () => {
  console.log("🚀 Supabase Storage → Cloudflare R2 마이그레이션");
  await migrateBucket("thumbnails", "thumbnails");
  await migrateBucket("models-private", "models-private");
  console.log("\n✅ 마이그레이션 완료!");
  console.log("⚠️  commission-files 버킷이 있다면 수동으로 확인하세요.");
})();
