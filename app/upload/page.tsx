"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase-browser";
import { showError, showInfo, showSuccess } from "../lib/toast";
import DescriptionTemplateSelector from "../components/DescriptionTemplateSelector";

export default function UploadPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("RING");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");

  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [detailImageFiles, setDetailImageFiles] = useState<File[]>([]);
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [extraFiles, setExtraFiles] = useState<File[]>([]);

  const [uploading, setUploading] = useState(false);

  const uploadBoxStyle: React.CSSProperties = {
    border: "1px dashed #cbd5e1",
    borderRadius: 18,
    padding: 18,
    background: "#f8fafc",
    display: "grid",
    gap: 10,
  };

  const helperTextStyle: React.CSSProperties = {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 1.5,
  };

  const fileListStyle: React.CSSProperties = {
    display: "grid",
    gap: 6,
    fontSize: 13,
    color: "#111827",
  };

  const handleDetailImages = (files: FileList | null) => {
    if (!files) return;
    setDetailImageFiles(Array.from(files).slice(0, 10));
  };

  const handleExtraFiles = (files: FileList | null) => {
    if (!files) return;
    setExtraFiles(Array.from(files).slice(0, 10));
  };

  const removeExtraFile = (idx: number) => {
    setExtraFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    try {
      if (!title.trim()) { showInfo("ëª¨ë¸ëª…ì„ ?…ë ¥?˜ì„¸??"); return; }
      if (!price.trim()) { showInfo("ê°€ê²©ì„ ?…ë ¥?˜ì„¸??"); return; }
      if (!thumbnailFile) { showError("?¸ë„¤???´ë?ì§€ë¥?? íƒ?˜ì„¸??"); return; }
      if (!modelFile) { showError("ì¶œë ¥(?€???Œì¼??? íƒ?˜ì„¸??"); return; }

      setUploading(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { showInfo("ë¡œê·¸?¸ì´ ?„ìš”?©ë‹ˆ??"); return; }

      const sellerId = session.user.id;
      const now = Date.now();

      // ?¸ë„¤???…ë¡œ??      const thumbExt = thumbnailFile.name.split(".").pop()?.toLowerCase() || "jpg";
      const thumbPath = `${sellerId}/${now}-thumb.${thumbExt}`;

      const { error: thumbUploadError } = await supabase.storage
        .from("thumbnails")
        .upload(thumbPath, thumbnailFile, { upsert: true });

      if (thumbUploadError) {
        showError(`?¸ë„¤???…ë¡œ???¤íŒ¨: ${thumbUploadError.message}`);
        return;
      }

      const thumbnailUrl = supabase.storage.from("thumbnails").getPublicUrl(thumbPath).data.publicUrl;

      // ?€??ëª¨ë¸ ?Œì¼ ?…ë¡œ??      const modelExt = modelFile.name.split(".").pop()?.toLowerCase() || "obj";
      const modelPath = `${sellerId}/${now}-model.${modelExt}`;

      const { error: modelUploadError } = await supabase.storage
        .from("models-private")
        .upload(modelPath, modelFile, { upsert: true });

      if (modelUploadError) {
        showError(`ëª¨ë¸ ?Œì¼ ?…ë¡œ???¤íŒ¨: ${modelUploadError.message}`);
        return;
      }

      // ëª¨ë¸ DB ?€??      const { data: insertedModel, error: insertModelError } = await supabase
        .from("models")
        .insert({
          title,
          category,
          price: Number(price),
          description,
          thumbnail: thumbnailUrl,
          thumbnail_path: thumbPath,
          seller_id: sellerId,
          file_url: "",
          model_file_path: modelPath,
        })
        .select("*")
        .single();

      if (insertModelError || !insertedModel) {
        console.error("ëª¨ë¸ ?€???¤íŒ¨:", insertModelError);
        showError("ëª¨ë¸ ?€?¥ì— ?¤íŒ¨?ˆìŠµ?ˆë‹¤.");
        return;
      }

      // ì¶”ê? ?´ë?ì§€ ?…ë¡œ??      if (detailImageFiles.length > 0) {
        const imageRows: any[] = [];

        for (let i = 0; i < detailImageFiles.length; i++) {
          const file = detailImageFiles[i];
          const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
          const path = `${sellerId}/detail-${now}-${i}.${ext}`;

          const { error } = await supabase.storage
            .from("thumbnails")
            .upload(path, file, { upsert: true });

          if (error) { console.error("ì¶”ê? ?´ë?ì§€ ?…ë¡œ???¤íŒ¨:", error); continue; }

          const url = supabase.storage.from("thumbnails").getPublicUrl(path).data.publicUrl;

          imageRows.push({ model_id: insertedModel.id, image_url: url, image_path: path, sort_order: i + 1 });
        }

        if (imageRows.length > 0) {
          const { error: imageInsertError } = await supabase.from("model_images").insert(imageRows);
          if (imageInsertError) console.error("ì¶”ê? ?´ë?ì§€ ?€???¤íŒ¨:", imageInsertError);
        }
      }

      // ì¶”ê? ?Œì¼ ?…ë¡œ??      if (extraFiles.length > 0) {
        const fileRows: any[] = [];

        for (let i = 0; i < extraFiles.length; i++) {
          const file = extraFiles[i];
          const ext = file.name.split(".").pop()?.toLowerCase() || "";
          const path = `${sellerId}/extra-${now}-${i}.${ext}`;

          const { error } = await supabase.storage
            .from("models-private")
            .upload(path, file, { upsert: true });

          if (error) { console.error("ì¶”ê? ?Œì¼ ?…ë¡œ???¤íŒ¨:", error); continue; }

          const { data: signedData, error: signedError } = await supabase.storage
            .from("models-private")
            .createSignedUrl(path, 60 * 60 * 24 * 7);

          if (signedError || !signedData?.signedUrl) {
            console.error("ì¶”ê? ?Œì¼ signed url ?ì„± ?¤íŒ¨:", signedError);
            continue;
          }

          fileRows.push({
            model_id: insertedModel.id,
            file_name: file.name,
            file_url: signedData.signedUrl,
            file_path: path,
            file_type: ext,
            sort_order: i + 1,
          });
        }

        if (fileRows.length > 0) {
          const { error: fileInsertError } = await supabase.from("model_files").insert(fileRows);
          if (fileInsertError) console.error("ì¶”ê? ?Œì¼ DB ?€???¤íŒ¨:", fileInsertError);
        }
      }

      showSuccess("ëª¨ë¸ ?…ë¡œ?œê? ?„ë£Œ?˜ì—ˆ?µë‹ˆ??");
      router.push("/my-models");
    } catch (error) {
      console.error("?…ë¡œ???¤ë¥˜:", error);
      showError("?…ë¡œ??ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <main
      className="upload-main"
      style={{
        maxWidth: 980,
        margin: "0 auto",
        padding: "36px 20px 60px",
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <h1 style={{ margin: 0, fontSize: 40, fontWeight: 900, color: "#111827" }}>
        ëª¨ë¸ ?…ë¡œ??      </h1>
      <p style={{ margin: "10px 0 0", color: "#6b7280", fontSize: 15 }}>
        ?¸ë„¤??1?¥ê³¼ ì¶”ê? ?´ë?ì§€ ìµœë? 10?¥ê¹Œì§€ ?…ë¡œ?œí•  ???ˆìŠµ?ˆë‹¤.
      </p>

      <form
        onSubmit={handleSubmit}
        className="upload-form"
        style={{
          marginTop: 24,
          border: "1px solid #e5e7eb",
          borderRadius: 28,
          background: "white",
          padding: 24,
          display: "grid",
          gap: 18,
        }}
      >
        <Field label="ëª¨ë¸ëª?>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={inputStyle}
          />
        </Field>

        <Field label="ì¹´í…Œê³ ë¦¬">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={inputStyle}
          >
            <option value="RING">RING</option>
            <option value="PENDANT">PENDANT</option>
            <option value="EARRING">EARRING</option>
            <option value="BRACELET">BRACELET</option>
            <option value="SET">SET</option>
          </select>
        </Field>

        <Field label="ê°€ê²?>
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ""))}
            style={inputStyle}
          />
        </Field>

        {/* ?¤ëª… + ê³µí†µ ?œí”Œë¦?ì»´í¬?ŒíŠ¸ */}
        <Field label="?¤ëª…">
          <DescriptionTemplateSelector
            description={description}
            onDescriptionChange={setDescription}
          />
        </Field>

        <Field label="?¸ë„¤???´ë?ì§€ *">
          <div style={uploadBoxStyle}>
            <div style={helperTextStyle}>?€?œë¡œ ë³´ì—¬ì§??´ë?ì§€ë¥?1???…ë¡œ?œí•˜?¸ìš”.</div>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)}
            />
            {thumbnailFile && (
              <div style={fileListStyle}>? íƒ ?Œì¼: {thumbnailFile.name}</div>
            )}
          </div>
        </Field>

        <Field label="ì¶”ê? ?´ë?ì§€ (ìµœë? 10??">
          <div style={uploadBoxStyle}>
            <div style={helperTextStyle}>
              ?ì„¸?˜ì´ì§€???¤ì–´ê°??´ë?ì§€ë¥??¬ëŸ¬ ???…ë¡œ?œí•  ???ˆìŠµ?ˆë‹¤.
            </div>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => handleDetailImages(e.target.files)}
            />
            <div style={fileListStyle}>
              <div>? íƒ???Œì¼ ?? {detailImageFiles.length}??/div>
              {detailImageFiles.map((file, idx) => (
                <div key={`${file.name}-${idx}`}>{idx + 1}. {file.name}</div>
              ))}
            </div>
          </div>
        </Field>

        <Field label="ì¶œë ¥(?€???Œì¼ *">
          <div style={uploadBoxStyle}>
            <div style={helperTextStyle}>
              ì¶œë ¥(?€???Œì¼ 1ê°œë? ?…ë¡œ?œí•˜?¸ìš”. ?? STL, OBJ, 3DM
            </div>
            <input
              type="file"
              accept=".stl,.obj,.3dm"
              onChange={(e) => setModelFile(e.target.files?.[0] || null)}
            />
            {modelFile && (
              <div style={fileListStyle}>? íƒ ?Œì¼: {modelFile.name}</div>
            )}
          </div>
        </Field>

        <Field label="ì¶”ê? ?Œì¼ (ìµœë? 10ê°?">
          <div style={uploadBoxStyle}>
            <div style={helperTextStyle}>
              ì¶œë ¥(?€???Œì¼ ?¸ì— ë³´ì¡° ?Œì¼??ì¶”ê?ë¡??…ë¡œ?œí•  ???ˆìŠµ?ˆë‹¤.
              ?? STL, OBJ, 3DM, ZIP, PDF
            </div>
            <input
              type="file"
              accept=".stl,.obj,.3dm,.zip,.pdf"
              multiple
              onChange={(e) => handleExtraFiles(e.target.files)}
            />

            {extraFiles.length > 0 && (
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 13, color: "#6b7280", fontWeight: 700 }}>
                  ? íƒ???Œì¼ ?? {extraFiles.length}ê°?                </div>
                {extraFiles.map((file, idx) => (
                  <div
                    key={`${file.name}-${idx}`}
                    style={{
                      display: "flex", alignItems: "center",
                      justifyContent: "space-between", gap: 10,
                      padding: "8px 12px",
                      borderRadius: 10, border: "1px solid #e5e7eb",
                      background: "white", fontSize: 13, color: "#111827",
                    }}
                  >
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {idx + 1}. {file.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeExtraFile(idx)}
                      style={{
                        flexShrink: 0, width: 28, height: 28, borderRadius: 8,
                        border: "1px solid #fca5a5", background: "white",
                        color: "#dc2626", fontWeight: 900, fontSize: 16,
                        cursor: "pointer", display: "flex",
                        alignItems: "center", justifyContent: "center",
                        lineHeight: 1,
                      }}
                      aria-label="?Œì¼ ?œê±°"
                    >
                      Ã—
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Field>

        <button
          type="submit"
          disabled={uploading}
          style={{
            width: "100%", height: 54, borderRadius: 16, border: "none",
            background: "#111827", color: "white",
            fontWeight: 900, fontSize: 17, cursor: "pointer",
          }}
        >
          {uploading ? "?…ë¡œ??ì¤?.." : "?…ë¡œ??}
        </button>
      </form>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 8, fontWeight: 800, color: "#111827" }}>
      {label}
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  height: 48,
  borderRadius: 14,
  border: "1px solid #d1d5db",
  padding: "0 14px",
  outline: "none",
  fontSize: 14,
  width: "100%",
  boxSizing: "border-box",
};
