"use client";

import Link from "next/link";
import styles from "../page.module.css";
import type { ModelItem } from "./ModelCard";

type Props = {
  item: ModelItem;
  liked: boolean;
  liking: boolean;
  onToggleFavorite: (id: string) => void;
  onQuickView: (item: ModelItem) => void;
  getThumbnailUrl: (item: ModelItem) => string;
};

export default function TopModelCard({
  item,
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
      href={`/models/${item.id}`}
      style={{
        textDecoration: "none",
        color: "inherit",
        minWidth: 0,
      }}
    >
      <article
        className={styles.modelCard}
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          overflow: "hidden",
          background: "white",
          boxShadow: "0 4px 14px rgba(15,23,42,0.06)",
          transition: "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
          height: "100%",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-4px)";
          e.currentTarget.style.boxShadow = "0 12px 28px rgba(15,23,42,0.12)";
          e.currentTarget.style.borderColor = "#d1d5db";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "0 4px 14px rgba(15,23,42,0.06)";
          e.currentTarget.style.borderColor = "#e5e7eb";
        }}
      >
        <div
          style={{
            position: "relative",
            background: "#f8fafc",
            height: 120,
            overflow: "hidden",
          }}
        >
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

          <span
            style={{
              position: "absolute",
              left: 10,
              top: 10,
              height: 24,
              padding: "0 8px",
              borderRadius: 999,
              display: "inline-flex",
              alignItems: "center",
              background: "rgba(15,23,42,0.82)",
              color: "white",
              fontSize: 11,
              fontWeight: 800,
            }}
          >
            {item.category}
          </span>

          {isPopular && (
            <div
              style={{
                position: "absolute",
                left: 10,
                top: 40,
                background: "#f59e0b",
                color: "white",
                fontSize: 10,
                fontWeight: 800,
                padding: "3px 7px",
                borderRadius: 999,
                whiteSpace: "nowrap",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              🔥 인기
            </div>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!liking) onToggleFavorite(item.id);
            }}
            aria-label="찜하기"
            style={{
              position: "absolute",
              right: 10,
              top: 10,
              width: 32,
              height: 32,
              borderRadius: "50%",
              border: "none",
              background: liked ? "#ef4444" : "rgba(15,23,42,0.45)",
              color: "white",
              fontSize: 16,
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
              bottom: 5,
              height: 20,
              padding: "0 5px",
              borderRadius: 999,
              border: "none",
              background: "rgba(255,255,255,0.92)",
              color: "#111827",
              fontSize: 11,
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Quick View
          </button>
        </div>

        <div
          style={{
            padding: 12,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 900,
              color: "#111827",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {item.title}
          </div>

          <div
            style={{
              fontSize: 11,
              color: "#6b7280",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {item.description || item.category}
          </div>

          <div
            style={{
              marginTop: 5,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: "#6b7280",
                fontWeight: 700,
              }}
            >
              다운로드 {item.download_count || 0}
            </span>

            <span
              style={{
                fontSize: 16,
                fontWeight: 900,
                color: "#111827",
              }}
            >
              {item.price.toLocaleString("ko-KR")}원
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
