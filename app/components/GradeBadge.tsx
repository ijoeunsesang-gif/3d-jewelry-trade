"use client";

import { GRADE_CONFIG, Grade } from "@/lib/grades";

interface GradeBadgeProps {
  grade: Grade;
  size?: "sm" | "md" | "lg" | "xl";
  showLabel?: boolean;
}

export default function GradeBadge({ grade, size = "md", showLabel = true }: GradeBadgeProps) {
  const cfg = GRADE_CONFIG[grade];

  const padding =
    size === "sm" ? "2px 7px" :
    size === "lg" ? "6px 14px" :
    size === "xl" ? "12px 32px" :
    "3px 10px";
  const fontSize =
    size === "sm" ? 11 :
    size === "lg" ? 15 :
    size === "xl" ? 24 :
    12;
  const fontWeight = size === "xl" ? 900 : 700;

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
        fontWeight,
        fontSize,
        lineHeight: 1.4,
        whiteSpace: "nowrap",
      }}
    >
      {showLabel && cfg.label}
    </span>
  );
}
