export const uploadToR2 = async (file: File, bucket: string, path: string): Promise<string> => {
  const presignRes = await fetch("/api/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      fileType: "application/octet-stream",
      bucket,
      path,
    }),
  });
  if (!presignRes.ok) {
    const body = await presignRes.json().catch(() => ({}));
    throw new Error(body.error || "presigned URL 발급 실패");
  }
  const { presignedUrl, path: uploadedPath } = await presignRes.json();
  const uploadRes = await fetch(presignedUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": "application/octet-stream" },
  });
  if (!uploadRes.ok) throw new Error(`R2 직접 업로드 실패 (${uploadRes.status})`);
  return uploadedPath;
};
