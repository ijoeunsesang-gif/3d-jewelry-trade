export type Grade = "sprout" | "skilled" | "pro" | "master";

export const GRADE_CONFIG = {
  sprout:  { label: "셀러",     emoji: "🌱", commission: 0.30, minSales: 0,   minAmount: 0,          color: "#16a34a", bg: "#dcfce7" },
  skilled: { label: "인증셀러", emoji: "⭐", commission: 0.20, minSales: 20,  minAmount: 1_000_000,  color: "#2563eb", bg: "#dbeafe" },
  pro:     { label: "프로셀러", emoji: "💎", commission: 0.15, minSales: 100, minAmount: 5_000_000,  color: "#7c3aed", bg: "#ede9fe" },
  master:  { label: "파트너",   emoji: "👑", commission: 0.10, minSales: 200, minAmount: 10_000_000, color: "#d97706", bg: "#fef3c7" },
} as const;

export function calcGrade(salesCount: number, salesAmount: number): Grade {
  if (salesCount >= 200 && salesAmount >= 10_000_000) return "master";
  if (salesCount >= 100 && salesAmount >= 5_000_000)  return "pro";
  if (salesCount >= 20  && salesAmount >= 1_000_000)  return "skilled";
  return "sprout";
}

export function gradeOrder(grade: Grade): number {
  return { sprout: 0, skilled: 1, pro: 2, master: 3 }[grade];
}

/* ── 멘토 등급 ── */
export type MentorGrade = "normal" | "certified" | "pro" | "master";

export const MENTOR_GRADE_CONFIG = {
  normal:    { label: "일반멘토",   commission: 0.25, minCompleted: 0,   minRating: 0,   color: "#374151", bg: "#f9fafb", border: "#d1d5db" },
  certified: { label: "인증멘토",   commission: 0.20, minCompleted: 10,  minRating: 4.0, color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe" },
  pro:       { label: "프로멘토",   commission: 0.15, minCompleted: 30,  minRating: 4.5, color: "#6d28d9", bg: "#f5f3ff", border: "#ddd6fe" },
  master:    { label: "마스터멘토", commission: 0.10, minCompleted: 100, minRating: 4.8, color: "#b45309", bg: "#fffbeb", border: "#fde68a" },
} as const;

export function calcMentorGrade(completedCount: number, avgRating: number): MentorGrade {
  if (completedCount >= 100 && avgRating >= 4.8) return "master";
  if (completedCount >= 30  && avgRating >= 4.5) return "pro";
  if (completedCount >= 10  && avgRating >= 4.0) return "certified";
  return "normal";
}

export function mentorGradeOrder(grade: MentorGrade): number {
  return { normal: 0, certified: 1, pro: 2, master: 3 }[grade];
}
