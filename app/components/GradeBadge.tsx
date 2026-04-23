"use client";

import { GRADE_CONFIG, Grade } from "@/lib/grades";

interface GradeBadgeProps {
  grade: Grade;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export default function GradeBadge({ grade, size = "md", showLabel = true }: GradeBadgeProps) {
  const cfg = GRADE_CONFIG[grade];

  const padding = size === "sm" ? "2px 7px" : size === "lg" ? "6px 14px" : "3px 10px";
  const fontSize = size === "sm" ? 11 : size === "lg" ? 15 : 12;
  const emojiSize = size === "sm" ? 12 : size === "lg" ? 18 : 14;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding,
        borderRadius: 999,
        background: cfg.bg,
        color: cfg.color,
        fontWeight: 700,
        fontSize,
        lineHeight: 1.4,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ fontSize: emojiSize }}>{cfg.emoji}</span>
      {showLabel && cfg.label}
    </span>
  );
}
