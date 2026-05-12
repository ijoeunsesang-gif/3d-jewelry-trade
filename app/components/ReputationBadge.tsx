"use client";

export type ReputationScore = {
  score: number;
  avg_rating?: number;
  total_reviews?: number;
};

export function getReputationBadge(score: number): { label: string; icon: string; color: string; bg: string } | null {
  if (score >= 1000) return { label: "마스터",  icon: "👑", color: "#b45309", bg: "#fef3c7" };
  if (score >= 600)  return { label: "전문",    icon: "⭐⭐⭐", color: "#7c3aed", bg: "#ede9fe" };
  if (score >= 300)  return { label: "우수",    icon: "⭐⭐",  color: "#2563eb", bg: "#dbeafe" };
  if (score >= 100)  return { label: "신뢰",    icon: "⭐",   color: "#16a34a", bg: "#dcfce7" };
  return null;
}

interface ReputationBadgeProps {
  score: number;
  size?: "sm" | "md";
}

export default function ReputationBadge({ score, size = "md" }: ReputationBadgeProps) {
  const badge = getReputationBadge(score);
  if (!badge) return null;

  const padding  = size === "sm" ? "2px 7px"  : "3px 10px";
  const fontSize = size === "sm" ? 11          : 12;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        padding,
        borderRadius: 999,
        background: badge.bg,
        color: badge.color,
        fontWeight: 700,
        fontSize,
        lineHeight: 1.4,
        whiteSpace: "nowrap",
      }}
    >
      {badge.icon} {badge.label}
    </span>
  );
}
