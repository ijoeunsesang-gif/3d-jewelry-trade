export type Grade = "sprout" | "skilled" | "pro" | "master";

export const GRADE_CONFIG = {
  sprout:  { label: "새싹",   emoji: "🌱", commission: 0.30, minSales: 0,   minAmount: 0,          color: "#16a34a", bg: "#dcfce7" },
  skilled: { label: "숙련",   emoji: "⭐", commission: 0.20, minSales: 50,  minAmount: 2_000_000,  color: "#2563eb", bg: "#dbeafe" },
  pro:     { label: "프로",   emoji: "💎", commission: 0.15, minSales: 200, minAmount: 5_000_000,  color: "#7c3aed", bg: "#ede9fe" },
  master:  { label: "마스터", emoji: "👑", commission: 0.10, minSales: 400, minAmount: 10_000_000, color: "#d97706", bg: "#fef3c7" },
} as const;

export function calcGrade(salesCount: number, salesAmount: number): Grade {
  if (salesCount >= 400 && salesAmount >= 10_000_000) return "master";
  if (salesCount >= 200 && salesAmount >= 5_000_000)  return "pro";
  if (salesCount >= 50  && salesAmount >= 2_000_000)  return "skilled";
  return "sprout";
}

export function gradeOrder(grade: Grade): number {
  return { sprout: 0, skilled: 1, pro: 2, master: 3 }[grade];
}
