"use client";

import Link from "next/link";
import styles from "../page.module.css";

export type ModelItem = {
  id: string;
  title: string;
  description: string;
  price: number;
  thumbnail: string;
  thumbnail_path?: string | null;
  file_url: string;
  model_file_path?: string | null;
  seller_id: string;
  category: string;
  created_at: string;
  download_count?: number;
};

type Props = {
  item: ModelItem;
  search: string;
  liked: boolean;
  liking: boolean;
  onToggleFavorite: (id: string) => void;
  onQuickView: (item: ModelItem) => void;
  getThumbnailUrl: (item: ModelItem) => string;
};

function highlightText(text: string, keyword: string) {
  if (!keyword.trim()) return text;
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return parts.map((part, idx) =>
    part.toLowerCase() === keyword.toLowerCase() ? (
      <mark key={`${part}-${idx}`} className={styles.mark}>
        {part}
      </mark>
    ) : (
      <span key={`${part}-${idx}`}>{part}</span>
    )
  );
}

export default function ModelCard({
  item,
  search,
  liked,
  liking,
  onToggleFavorite,
  onQuickView,
  getThumbnailUrl,
}: Props) {
  const thumbUrl = getThumbnailUrl(item);
  const isPopular = (item.download_count || 0) >= 5;

  return (
    <Link
      key={item.id}
      href={`/models/${item.id}`}
      className={styles.modelLink}
      style={{ textDecoration: "none", color: "inherit" }}
    >
      <article
        className={styles.modelCard}
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 22,
          overflow: "hidden",
          background: "white",
          boxShadow: "0 6px 20px rgba(15, 23, 42, 0.04)",
          display: "flex",
          flexDirection: "column",
          height: "100%",
        }}
      >
        <div
          className={styles.thumbWrap}
          style={{
            background: "#0b1220",
            aspectRatio: "16 / 10",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div className={styles.thumbPlaceholder}>
            {thumbUrl ? (
              <img
                src={thumbUrl}
                alt={item.title}
                className={styles.thumbImg}
                loading="lazy"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                  transition: "transform 0.25s ease",
                }}
              />
            ) : null}
          </div>

          <span
            className={styles.typeBadge}
            style={{
              position: "absolute",
              left: 12,
              top: 12,
              height: 28,
              padding: "0 10px",
              borderRadius: 999,
              display: "inline-flex",
              alignItems: "center",
              background: "rgba(15,23,42,0.82)",
              color: "white",
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            {item.category}
          </span>

          <button
            type="button"
            className={`${styles.favoriteBtn} ${liked ? styles.favoriteBtnActive : ""}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!liking) onToggleFavorite(item.id);
            }}
            aria-label="찜하기"
            style={{
              position: "absolute",
              right: 12,
              top: 12,
              width: 36,
              height: 36,
              borderRadius: "50%",
              border: "none",
              background: liked ? "#ef4444" : "rgba(15,23,42,0.45)",
              color: "white",
              fontSize: 18,
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            {liked ? "♥" : "♡"}
          </button>

          <button
            type="button"
            className={styles.quickBtn}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onQuickView(item);
            }}
            style={{
              position: "absolute",
              left: 12,
              bottom: 12,
              height: 34,
              padding: "0 14px",
              borderRadius: 999,
              border: "none",
              background: "rgba(255,255,255,0.92)",
              color: "#111827",
              fontSize: 12,
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Quick View
          </button>

          {isPopular && (
            <div
              style={{
                position: "absolute",
                left: 14,
                top: 50,
                background: "#f59e0b",
                color: "white",
                fontSize: 11,
                fontWeight: 800,
                padding: "4px 8px",
                borderRadius: 999,
                zIndex: 3,
                whiteSpace: "nowrap",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              🔥 인기
            </div>
          )}

          <div
            style={{
              position: "absolute",
              right: 10,
              bottom: 10,
              background: "rgba(15,23,42,0.8)",
              color: "white",
              fontSize: 12,
              fontWeight: 700,
              padding: "6px 10px",
              borderRadius: 999,
            }}
          >
            다운로드 {item.download_count || 0}
          </div>
        </div>

        <div
          className={styles.modelInfo}
          style={{
            padding: 15,
            display: "flex",
            flexDirection: "column",
            flex: 1,
          }}
        >
          <div className={styles.modelTitleRow}>
            <p
              className={styles.modelTitle}
              style={{
                fontSize: 20,
                fontWeight: 900,
                color: "#111827",
                margin: 0,
              }}
            >
              {highlightText(item.title, search)}
            </p>
          </div>

          <p
            className={styles.modelMeta}
            style={{
              marginTop: 8,
              color: "#6b7280",
              fontSize: 13,
              minHeight: 38,
              lineHeight: 1.5,
            }}
          >
            {highlightText(
              (item.description || item.category).slice(0, 50),
              search
            )}
          </p>

          <div
            style={{
              marginTop: 12,
              fontSize: 22,
              fontWeight: 900,
              color: "#111827",
              textAlign: "right",
            }}
          >
            {item.price.toLocaleString("ko-KR")}원
          </div>

          <div
            className={styles.cardBottom}
            style={{
              borderTop: "1px solid #f1f5f9",
              paddingTop: 12,
              marginTop: "auto",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 12,
              color: "#16a34a",
              fontWeight: 800,
            }}
          >
            <span className={styles.miniMeta}>즉시 다운로드</span>
            <span className={styles.ctaHint} style={{ fontWeight: 700 }}>
              자세히 보기 ↗
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
