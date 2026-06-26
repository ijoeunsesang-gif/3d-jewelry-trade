import imageCompression from "browser-image-compression";

export const compressImage = async (file: File): Promise<File> => {
  const options = {
    maxSizeMB: 0.5,
    maxWidthOrHeight: 1200,
    useWebWorker: true,
    fileType: "image/webp" as const,
  };
  try {
    const compressed = await imageCompression(file, options);
    return new File([compressed], file.name.replace(/\.[^.]+$/, ".webp"), {
      type: "image/webp",
    });
  } catch {
    return file;
  }
};

export const compressThumbnail = async (file: File): Promise<File> => {
  const options = {
    maxSizeMB: 0.3,
    maxWidthOrHeight: 800,
    useWebWorker: true,
    fileType: "image/webp" as const,
  };
  try {
    const compressed = await imageCompression(file, options);
    return new File([compressed], file.name.replace(/\.[^.]+$/, ".webp"), {
      type: "image/webp",
    });
  } catch {
    return file;
  }
};
