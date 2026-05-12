import { startProgress, updateProgress, completeProgress, errorProgress } from "@/app/lib/progressStore";

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

  const progressId = `r2-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  startProgress(progressId, file.name, "uploading");

  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        updateProgress(progressId, Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        completeProgress(progressId);
        resolve(uploadedPath);
      } else {
        errorProgress(progressId, `업로드 실패 (${xhr.status})`);
        reject(new Error(`R2 직접 업로드 실패 (${xhr.status})`));
      }
    };

    xhr.onerror = () => {
      errorProgress(progressId, "업로드 실패");
      reject(new Error("R2 직접 업로드 실패"));
    };

    xhr.open("PUT", presignedUrl);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.send(file);
  });
};
