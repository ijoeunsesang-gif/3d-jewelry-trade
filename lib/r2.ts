import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true, // R2는 path-style만 지원
});

export async function r2Upload(
  bucket: string,
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await r2.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
}

export async function r2SignedUrl(
  bucket: string,
  key: string,
  expiresIn = 180,
): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(r2, cmd, { expiresIn });
}

export function r2PublicUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${path}`;
}
