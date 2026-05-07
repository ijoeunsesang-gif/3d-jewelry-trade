export const DEFAULT_BANNED_WORDS = [
  // 영문 브랜드명 및 위험 단어
  "replica",
  "cartier style",
  "cartier",
  "tiffany",
  "van cleef",
  "chrome hearts",
  "louis vuitton",
  "gucci",
  "chanel",
  "dior",
  "hermes",
  "bvlgari",
  "bulgari",
  "inspired by",
  "1:1",
  "fake",
  "copy",
  // 한국어 브랜드명 및 위험 단어
  "까르띠에",
  "구찌",
  "루이비통",
  "샤넬",
  "디올",
  "에르메스",
  "불가리",
  "반클리프",
  "크롬하츠",
  "티파니",
  "레플리카",
  "짝퉁",
  "카피",
  "복제",
];

/** 텍스트에서 금지어를 감지하여 감지된 단어 목록을 반환 */
export function detectBannedWords(text: string, words: string[]): string[] {
  const lower = text.toLowerCase();
  return words.filter((w) => lower.includes(w.toLowerCase()));
}
