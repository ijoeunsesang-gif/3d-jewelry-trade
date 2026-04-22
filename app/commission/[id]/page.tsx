"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase-browser";
import { getAccessToken, decodeJwt } from "@/lib/supabase-fetch";
import { showError, showSuccess } from "../../lib/toast";

const GOLD = "#c9a84c";

const STATUS_LABEL: Record<string, string> = {
  open: "의뢰중",
  in_progress: "작업중",
  completed: "완료",
};
const STATUS_COLOR: Record<string, string> = {
  open: "#2563eb", in_progress: "#d97706", completed: "#16a34a",
};
const STATUS_BG: Record<string, string> = {
  open: "#dbeafe", in_progress: "#fef3c7", completed: "#dcfce7",
};

type Commission = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  images: string[];
  status: string;
  result_link: string | null;
  created_at: string;
  nickname: string;
};

export default function CommissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [commission, setCommission] = useState<Commission | null>(null);
  const [loading, setLoading] = useState(true);
  const [myId, setMyId] = useState<string | null>(null);
  const [isSeller, setIsSeller] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);
  const [editStatus, setEditStatus] = useState("open");
  const [editResultLink, setEditResultLink] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      const uid = (decodeJwt(token) as any)?.sub as string;
      setMyId(uid);
      supabase
        .from("profiles")
        .select("role")
        .eq("id", uid)
        .single()
        .then(({ data }) => { setIsSeller(data?.role === "seller"); });
    }
    fetchCommission();
  }, [id]);

  const fetchCommission = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("commissions")
        .select("id, user_id, title, description, images, status, result_link, created_at")
        .eq("id", id)
        .single();

      if (error || !data) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("nickname")
        .eq("id", data.user_id)
        .single();

      const c: Commission = { ...data, nickname: profile?.nickname || "익명" };
      setCommission(c);
      setEditStatus(c.status);
      setEditResultLink(c.result_link || "");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!commission) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("commissions")
        .update({
          status: editStatus,
          result_link: editResultLink.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", commission.id);

      if (error) throw error;
      setCommission((prev) =>
        prev ? { ...prev, status: editStatus, result_link: editResultLink.trim() || null } : prev
      );
      showSuccess("저장되었습니다.");
    } catch (e: any) {
      showError(e.message || "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!commission || !confirm("정말 삭제하시겠습니까?")) return;
    setDeleting(true);
    const { error } = await supabase.from("commissions").delete().eq("id", commission.id);
    if (error) { showError("삭제 실패"); setDeleting(false); return; }
    router.push("/commission");
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 20px", fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ height: 28, background: "#f3f4f6", borderRadius: 8, marginBottom: 20, width: "55%" }} />
        <div style={{ height: 360, background: "#f3f4f6", borderRadius: 14, marginBottom: 16 }} />
        <div style={{ height: 120, background: "#f3f4f6", borderRadius: 14 }} />
      </div>
    );
  }

  if (!commission) {
    return (
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "80px 20px", textAlign: "center", fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>😢</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>의뢰를 찾을 수 없습니다</div>
        <Link href="/commission" style={{ display: "inline-block", marginTop: 20, color: GOLD, textDecoration: "none", fontWeight: 700 }}>
          목록으로 돌아가기
        </Link>
      </div>
    );
  }

  const isAuthor = myId === commission.user_id;
  const displayResultLink = isSeller ? editResultLink : (commission.result_link || "");

  return (
    <div style={{
      maxWidth: 800, margin: "0 auto",
      padding: "32px 20px 80px",
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      {/* 뒤로가기 */}
      <Link href="/commission" style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        color: "#6b7280", textDecoration: "none", fontSize: 14, marginBottom: 24,
      }}>
        ← 목록으로
      </Link>

      {/* 제목 + 상태 */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#111827", lineHeight: 1.35, flex: 1 }}>
          {commission.title}
        </h1>
        <span style={{
          flexShrink: 0, fontSize: 12, fontWeight: 700,
          color: STATUS_COLOR[commission.status] || "#374151",
          background: STATUS_BG[commission.status] || "#f3f4f6",
          padding: "4px 12px", borderRadius: 999,
        }}>
          {STATUS_LABEL[commission.status] || commission.status}
        </span>
      </div>

      {/* 작성자 + 날짜 */}
      <div style={{ display: "flex", gap: 10, marginBottom: 28, fontSize: 13, color: "#6b7280" }}>
        <span>{commission.nickname}</span>
        <span>·</span>
        <span>{formatDate(commission.created_at)}</span>
      </div>

      {/* 이미지 갤러리 */}
      {commission.images && commission.images.length > 0 ? (
        <div style={{ marginBottom: 28 }}>
          <div style={{
            width: "100%", aspectRatio: "16/9", borderRadius: 14,
            overflow: "hidden", background: "#f8fafc", marginBottom: 10,
          }}>
            <img
              src={commission.images[selectedImage]}
              alt={commission.title}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
          {commission.images.length > 1 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {commission.images.map((img, i) => (
                <div
                  key={i}
                  onClick={() => setSelectedImage(i)}
                  style={{
                    width: 64, height: 64, borderRadius: 8, overflow: "hidden",
                    cursor: "pointer", flexShrink: 0,
                    border: selectedImage === i ? `2px solid ${GOLD}` : "2px solid transparent",
                    transition: "border-color 0.15s",
                  }}
                >
                  <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{
          width: "100%", aspectRatio: "16/9", borderRadius: 14,
          background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center",
          color: "#d1d5db", fontSize: 48, marginBottom: 28,
        }}>
          📋
        </div>
      )}

      {/* 설명 */}
      {commission.description && (
        <div style={{
          background: "#f8fafc", borderRadius: 14, padding: "18px 20px",
          fontSize: 14, color: "#374151", lineHeight: 1.8,
          marginBottom: 28, whiteSpace: "pre-wrap",
        }}>
          {commission.description}
        </div>
      )}

      {/* 결과물 링크 (판매자가 아닌 경우 표시) */}
      {!isSeller && commission.result_link && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 8 }}>결과물 링크</div>
          <a
            href={commission.result_link}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "9px 18px", borderRadius: 10,
              background: "#f0fdf4", color: "#16a34a",
              textDecoration: "none", fontSize: 13, fontWeight: 700,
              border: "1px solid #bbf7d0",
            }}
          >
            🔗 결과물 보기
          </a>
        </div>
      )}

      {/* 판매자 관리 패널 */}
      {isSeller && (
        <div style={{
          border: "1px solid #e5e7eb", borderRadius: 14,
          padding: "20px", marginBottom: 28, background: "#fafafa",
        }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#111827", marginBottom: 18 }}>판매자 관리</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 6 }}>
                상태 변경
              </label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                style={{
                  height: 44, borderRadius: 10, border: "1px solid #d1d5db",
                  padding: "0 12px", fontSize: 14, background: "white",
                  width: "100%", outline: "none", cursor: "pointer",
                }}
              >
                <option value="open">의뢰중</option>
                <option value="in_progress">작업중</option>
                <option value="completed">완료</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 6 }}>
                결과물 링크
              </label>
              <input
                type="url"
                value={editResultLink}
                onChange={(e) => setEditResultLink(e.target.value)}
                placeholder="https://..."
                style={{
                  height: 44, borderRadius: 10, border: "1px solid #d1d5db",
                  padding: "0 12px", fontSize: 14, width: "100%",
                  boxSizing: "border-box", outline: "none",
                }}
              />
            </div>

            {editResultLink.trim() && (
              <a
                href={editResultLink.trim()}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "9px 18px", borderRadius: 10,
                  background: "#f0fdf4", color: "#16a34a",
                  textDecoration: "none", fontSize: 13, fontWeight: 700,
                  border: "1px solid #bbf7d0", alignSelf: "flex-start",
                }}
              >
                🔗 결과물 보기
              </a>
            )}

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              style={{
                height: 44, borderRadius: 10, border: "none",
                background: saving ? "#d1d5db" : GOLD,
                color: "white", fontSize: 14, fontWeight: 700,
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      )}

      {/* 작성자 삭제 버튼 */}
      {isAuthor && (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            style={{
              padding: "8px 18px", borderRadius: 8,
              border: "1px solid #fca5a5", background: "white",
              color: "#dc2626", fontSize: 13, fontWeight: 700,
              cursor: deleting ? "not-allowed" : "pointer",
            }}
          >
            {deleting ? "삭제 중..." : "삭제"}
          </button>
        </div>
      )}
    </div>
  );
}
