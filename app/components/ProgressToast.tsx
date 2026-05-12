"use client";

import { useEffect, useState } from "react";
import { PROGRESS_EVENT } from "@/app/lib/progressStore";
import type { ProgressItem } from "@/app/lib/progressStore";

export default function ProgressToast() {
  const [items, setItems] = useState<Map<string, ProgressItem>>(new Map());

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<Partial<ProgressItem> & { id: string }>).detail;

      setItems((prev) => {
        const next = new Map(prev);
        const existing = next.get(detail.id) ?? { id: detail.id, label: "", percent: 0, status: "uploading" as const };
        const updated: ProgressItem = { ...existing, ...detail } as ProgressItem;
        next.set(detail.id, updated);

        if (updated.status === "done" || updated.status === "error") {
          setTimeout(() => {
            setItems((curr) => {
              const n = new Map(curr);
              n.delete(detail.id);
              return n;
            });
          }, 2000);
        }

        return next;
      });
    };

    window.addEventListener(PROGRESS_EVENT, handler);
    return () => window.removeEventListener(PROGRESS_EVENT, handler);
  }, []);

  const list = Array.from(items.values());
  if (list.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        zIndex: 9998,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        width: 300,
        maxWidth: "calc(100vw - 32px)",
      }}
    >
      {list.map((item) => {
        const isDone = item.status === "done";
        const isError = item.status === "error";
        const barColor = isError ? "#dc2626" : isDone ? "#16a34a" : "#111827";

        return (
          <div
            key={item.id}
            style={{
              background: "white",
              borderRadius: 14,
              padding: "12px 14px",
              boxShadow: "0 8px 28px rgba(0,0,0,0.13)",
              border: `1px solid ${isError ? "#fca5a5" : "#e5e7eb"}`,
              fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8 }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: isError ? "#dc2626" : "#111827",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  flex: 1,
                }}
              >
                {item.label}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: barColor, flexShrink: 0 }}>
                {isDone ? "완료" : isError ? "실패" : `${item.percent}%`}
              </span>
            </div>

            {!isError && (
              <div style={{ height: 5, background: "#f3f4f6", borderRadius: 3, overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${item.percent}%`,
                    background: barColor,
                    borderRadius: 3,
                    transition: "width 0.15s ease",
                  }}
                />
              </div>
            )}

            {isError && item.message && (
              <div style={{ fontSize: 11, color: "#dc2626", marginTop: 2 }}>{item.message}</div>
            )}

            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 5 }}>
              {item.status === "uploading"
                ? "업로드 중..."
                : item.status === "downloading"
                ? "다운로드 중..."
                : ""}
            </div>
          </div>
        );
      })}
    </div>
  );
}
