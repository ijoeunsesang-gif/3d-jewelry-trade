import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export const maxDuration = 60; // 첨부파일 다운로드를 위해 60초로 연장

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const adminSupabase = createClient(supabaseUrl, serviceRoleKey);
const publicSupabase = createClient(supabaseUrl, supabaseAnonKey);
const resend = new Resend(process.env.RESEND_API_KEY!);

const MAX_FILE_BYTES = 40 * 1024 * 1024;   // 40MB per file
const MAX_TOTAL_BYTES = 35 * 1024 * 1024;  // 35MB total (headroom for email overhead)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      modelId,
      printerEmail,
      senderEmail,
      businessName,
      phoneNumber,
      printType,
      castingType,
      scaleType,
      scalePercent,
      extraNote,
      selectedFilePaths,
    } = body as {
      modelId?: string;
      printerEmail?: string;
      senderEmail?: string;
      businessName?: string;
      phoneNumber?: string;
      printType?: string;
      castingType?: string;
      scaleType?: string;
      scalePercent?: string;
      extraNote?: string;
      selectedFilePaths?: string[];
    };

    if (!modelId || !printerEmail || !businessName) {
      return NextResponse.json({ error: "modelId, printerEmail, businessName이 필요합니다." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(printerEmail)) {
      return NextResponse.json({ error: "유효하지 않은 이메일 주소입니다." }, { status: 400 });
    }

    // 인증
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "인증 정보가 없습니다." }, { status: 401 });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await publicSupabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: "유효하지 않은 사용자입니다." }, { status: 401 });
    }

    // 구매 확인
    const { data: purchase, error: purchaseError } = await adminSupabase
      .from("purchases").select("id").eq("user_id", user.id).eq("model_id", modelId).maybeSingle();
    if (purchaseError || !purchase) {
      return NextResponse.json({ error: "구매한 사용자만 파일을 전송할 수 있습니다." }, { status: 403 });
    }

    // 모델 정보
    const { data: model, error: modelError } = await adminSupabase
      .from("models").select("title, model_file_path").eq("id", modelId).single();
    if (modelError || !model?.model_file_path) {
      return NextResponse.json({ error: "모델 파일 경로를 찾을 수 없습니다." }, { status: 404 });
    }

    // 추가 파일 목록
    const { data: extraFiles } = await adminSupabase
      .from("model_files").select("file_name, file_path").eq("model_id", modelId).order("sort_order", { ascending: true });

    // 유효한 경로 목록
    const validPaths = new Map<string, string>();
    validPaths.set(model.model_file_path, model.model_file_path.split("/").pop() || "대표 파일");
    (extraFiles || []).forEach((f: any) => validPaths.set(f.file_path, f.file_name));

    const pathsToSend = selectedFilePaths && selectedFilePaths.length > 0
      ? selectedFilePaths.filter((p) => validPaths.has(p))
      : Array.from(validPaths.keys());

    if (pathsToSend.length === 0) {
      return NextResponse.json({ error: "전송할 파일이 없습니다." }, { status: 400 });
    }

    // ── 파일 처리: 첨부 or 링크 ──────────────────────────────
    type EmailAttachment = { filename: string; content: string; isMain: boolean }; // base64
    type LinkFile = { name: string; url: string; isMain: boolean };

    const emailAttachments: EmailAttachment[] = [];
    const linkFiles: LinkFile[] = [];
    const oversizedFiles: string[] = [];
    let totalAttachmentBytes = 0;

    for (const path of pathsToSend) {
      const { data: signed } = await adminSupabase.storage
        .from("models-private").createSignedUrl(path, 60 * 60 * 24);
      if (!signed?.signedUrl) continue;

      const fileName = validPaths.get(path) || path.split("/").pop() || "파일";
      const isMain = path === model.model_file_path;

      try {
        // 파일 크기 확인 (HEAD 요청)
        let contentLength = 0;
        try {
          const headRes = await fetch(signed.signedUrl, { method: "HEAD" });
          contentLength = parseInt(headRes.headers.get("content-length") || "0", 10);
        } catch {
          // HEAD 실패 시 무시하고 다운로드 시도
        }

        const exceedsPerFile = contentLength > 0 && contentLength > MAX_FILE_BYTES;
        const exceedsTotal = contentLength > 0 && (totalAttachmentBytes + contentLength) > MAX_TOTAL_BYTES;

        if (exceedsPerFile || exceedsTotal) {
          linkFiles.push({ name: fileName, url: signed.signedUrl, isMain });
          const sizeMB = `${(contentLength / 1024 / 1024).toFixed(1)}MB`;
          oversizedFiles.push(`${fileName} (${sizeMB})`);
        } else {
          const fileRes = await fetch(signed.signedUrl);
          if (!fileRes.ok) throw new Error(`파일 다운로드 실패: ${fileRes.status}`);
          const arrayBuffer = await fileRes.arrayBuffer();
          const actualSize = arrayBuffer.byteLength;

          // 실제 크기가 한도를 초과하면 링크로 전환
          if (actualSize > MAX_FILE_BYTES || (totalAttachmentBytes + actualSize) > MAX_TOTAL_BYTES) {
            linkFiles.push({ name: fileName, url: signed.signedUrl, isMain });
            oversizedFiles.push(`${fileName} (${(actualSize / 1024 / 1024).toFixed(1)}MB)`);
          } else {
            const base64 = Buffer.from(arrayBuffer).toString("base64");
            emailAttachments.push({ filename: fileName, content: base64, isMain });
            totalAttachmentBytes += actualSize;
          }
        }
      } catch {
        // 오류 시 링크로 폴백
        linkFiles.push({ name: fileName, url: signed.signedUrl, isMain });
      }
    }

    if (emailAttachments.length === 0 && linkFiles.length === 0) {
      return NextResponse.json({ error: "파일 처리에 실패했습니다." }, { status: 500 });
    }

    // ── 이메일 본문 구성 ──────────────────────────────────────
    const scaleText = !scaleType ? "없음" : scalePercent ? `${scaleType} ${scalePercent}%` : scaleType;

    const infoRows = [
      { label: "출력형태",      value: printType || "-" },
      { label: "주물여부",      value: castingType || "-" },
      { label: "확대축소",      value: scaleText },
      { label: "전화번호",      value: phoneNumber || "-" },
      { label: "보내는 이메일", value: senderEmail || user.email || "-" },
      { label: "추가 내용",     value: extraNote || "-" },
    ];

    const infoHtml = infoRows.map((r) => `
      <tr>
        <td style="padding: 8px 14px; font-size: 13px; color: #6b7280; font-weight: 700; white-space: nowrap; width: 1%; background: #f8fafc; border-bottom: 1px solid #f3f4f6; text-align: left;">${r.label}</td>
        <td style="padding: 8px 14px; font-size: 13px; color: #111827; font-weight: 800; border-bottom: 1px solid #f3f4f6; text-align: left;">${r.value}</td>
      </tr>`).join("");

    const attachedListHtml = emailAttachments.length > 0
      ? `<div style="margin-bottom: 24px;">
          <div style="font-size: 13px; font-weight: 800; color: #374151; margin-bottom: 10px;">첨부파일 (${emailAttachments.length}개)</div>
          ${emailAttachments.map((f) => `
            <div style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 8px; background: #f8fafc; border: 1px solid #e5e7eb; margin-bottom: 6px;">
              <span style="font-size: 11px; font-weight: 900; padding: 2px 6px; border-radius: 4px; background: ${f.isMain ? "#111827" : "#4f46e5"}; color: white;">${f.isMain ? "대표" : "추가"}</span>
              <span style="font-size: 13px; color: #374151; font-weight: 700;">${f.filename}</span>
            </div>`).join("")}
        </div>`
      : "";

    const linkFilesHtml = linkFiles.length > 0
      ? `<div style="margin-bottom: 24px;">
          <div style="font-size: 13px; font-weight: 800; color: #374151; margin-bottom: 4px;">링크 파일 (${linkFiles.length}개 · 24시간 유효)</div>
          <div style="font-size: 12px; color: #ef4444; margin-bottom: 10px;">※ 파일 크기 초과로 링크로 전달됩니다.</div>
          ${linkFiles.map((f) => `
            <div style="margin-bottom: 8px;">
              <a href="${f.url}" style="display: inline-flex; align-items: center; gap: 8px; background: ${f.isMain ? "#111827" : "#4f46e5"}; color: white; text-decoration: none; font-weight: 700; font-size: 13px; padding: 10px 18px; border-radius: 10px;">
                <span style="font-size: 11px; background: rgba(255,255,255,0.2); padding: 2px 6px; border-radius: 4px;">${f.isMain ? "대표" : "추가"}</span>
                ${f.name}
              </a>
            </div>`).join("")}
        </div>`
      : "";

    const fromAddress = process.env.RESEND_FROM_EMAIL;
    if (!fromAddress) {
      return NextResponse.json(
        { error: "발신 이메일이 설정되지 않았습니다. RESEND_FROM_EMAIL 환경변수를 설정해주세요." },
        { status: 500 }
      );
    }

    const { error: emailError } = await resend.emails.send({
      from: `3D Jewelry Trade <${fromAddress}>`,
      to: printerEmail,
      replyTo: (senderEmail || user.email) || undefined,
      subject: `<${businessName}> 출력부탁드려요`,
      attachments: emailAttachments.map((f) => ({ filename: f.filename, content: f.content })),
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 580px; margin: 0 auto; padding: 32px 24px; color: #111827; text-align: left;">
          <h2 style="font-size: 22px; font-weight: 900; margin: 0 0 6px; text-align: left;">3D 출력 파일 전달</h2>
          <p style="color: #6b7280; margin: 0 0 24px; font-size: 14px; text-align: left;">안녕하세요, 아래 내용으로 출력 부탁드립니다.</p>

          <table style="width: 100%; border-collapse: collapse; border-radius: 12px; overflow: hidden; border: 1px solid #f3f4f6; margin-bottom: 24px;">
            ${infoHtml}
          </table>

          ${attachedListHtml}
          ${linkFilesHtml}

          <p style="font-size: 12px; color: #9ca3af; margin: 20px 0 0; text-align: left;">본 메일은 3D Jewelry Trade 플랫폼에서 자동 발송되었습니다.</p>
        </div>
      `,
    });

    if (emailError) {
      console.error("이메일 발송 실패:", JSON.stringify(emailError));
      return NextResponse.json(
        { error: `이메일 발송 실패: ${(emailError as any)?.message || JSON.stringify(emailError)}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, oversizedFiles });
  } catch (error) {
    console.error("출력소 전송 API 오류:", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
