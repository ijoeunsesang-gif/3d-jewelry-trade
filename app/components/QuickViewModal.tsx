"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import styles from "../page.module.css";
import type { ModelItem } from "./ModelCard";
import type { ProfileItem } from "../lib/getProfile";
import ErrorBoundary from "./ErrorBoundary";

const ModelViewer = dynamic(() => import("./ModelViewer"), { ssr: false });

type Props = {
  model: ModelItem;
  seller: ProfileItem | null;
  viewerUrl: string;
  viewerLoading: boolean;
  liked: boolean;
  favoriteLoading: boolean;
  onClose: () => void;
  onToggleFavorite: () => void;
  getThumbnailUrl: (item: ModelItem) => string;
};

function getModelExt(item: ModelItem) {
  const source = item.model_file_path || item.file_url || "";
  const clean = source.split("?")[0];
  return clean.split(".").pop()?.toLowerCase() || "";
}

export default function QuickViewModal({
  model,
  seller,
  viewerUrl,
  viewerLoading,
  liked,
  favoriteLoading,
  onClose,
  onToggleFavorite,
  getThumbnailUrl,
}: Props) {
  const thumbUrl = getThumbnailUrl(model);
  const ext = getModelExt(model);
  const viewerSupported = ["stl", "obj"].includes(ext);

  return (
    <div onClick={onClose} className={styles.modalOverlay}>
      <div onClick={(e) => e.stopPropagation()} className={styles.modalCard}>
        <div className={styles.modalViewerPane}>
          {viewerLoading ? (
            <div className={styles.modalLoading}>3D 파일 준비 중...</div>
          ) : viewerSupported && viewerUrl ? (
            <div className={styles.modalViewerInner}>
              <ErrorBoundary>
                <ModelViewer url={viewerUrl} />
              </ErrorBoundary>
            </div>
          ) : thumbUrl ? (
            <img
              src={thumbUrl}
              alt={model.title}
              className={styles.modalPreviewImage}
            />
          ) : (
            <div className={styles.modalLoading}>PREVIEW</div>
          )}
        </div>

        <div
          style={{
            padding: 28,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            minHeight: 440,
            background: "white",
          }}
        >
          <div>
            {seller && (
              <Link
                href={`/seller/${seller.id}`}
                style={{
                  marginTop: 5,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  textDecoration: "none",
                  color: "#111827",
                }}
              >
                <img
                  src={seller.avatar_url || "/default-avatar.png"}
                  alt={seller.nickname || "seller"}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    objectFit: "cover",
                    border: "1px solid #e5e7eb",
                    flexShrink: 0,
                  }}
                />
                <div>
                  <div style={{ fontWeight: 800 }}>
                    {seller.nickname || "판매자"}
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    판매자 페이지 이동
                  </div>
                </div>
              </Link>
            )}

            <button
              type="button"
              onClick={onToggleFavorite}
              disabled={favoriteLoading}
              style={{
                marginTop: 10,
                width: "100%",
                height: 46,
                borderRadius: 14,
                border: liked ? "none" : "1px solid #d1d5db",
                background: liked ? "#ef4444" : "white",
                color: liked ? "white" : "#111827",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              {favoriteLoading ? "처리 중..." : liked ? "찜 해제" : "찜하기"}
            </button>
          </div>

          <div>
            <h3
              style={{
                margin: "5px 0 0",
                fontSize: 30,
                fontWeight: 900,
                color: "#111827",
              }}
            >
              {model.title}
            </h3>

            <p
              style={{
                margin: "14px 0 0",
                color: "#6b7280",
                fontSize: 14,
                lineHeight: 1.7,
                whiteSpace: "pre-wrap",
                minHeight: 80,
              }}
            >
              {model.description || "제품 설명이 없습니다."}
            </p>
          </div>

          <div style={{ marginTop: "auto" }}>
            <div
              style={{
                textAlign: "right",
                fontSize: 30,
                fontWeight: 900,
                marginBottom: 15,
              }}
            >
              {model.price.toLocaleString("ko-KR")}원
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                marginTop: 10,
              }}
            >
              <Link
                href={`/models/${model.id}`}
                style={{
                  height: 50,
                  borderRadius: 16,
                  background: "#111827",
                  color: "white",
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 900,
                }}
              >
                상세로 이동
              </Link>

              <button
                type="button"
                onClick={onClose}
                style={{
                  height: 50,
                  borderRadius: 16,
                  border: "1px solid #d1d5db",
                  background: "white",
                  color: "#111827",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                닫기
              </button>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: 6,
              }}
            >
              <p
                style={{
                  margin: 0,
                  color: "#6b7280",
                  fontSize: 13,
                  whiteSpace: "nowrap",
                }}
              >
                • ESC 키로 닫기 가능
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
