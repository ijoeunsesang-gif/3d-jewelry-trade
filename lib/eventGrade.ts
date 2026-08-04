// 등급 상향 이벤트: event_settings는 이 고정 id 1행만 사용하는 싱글턴이다.
export const EVENT_SETTINGS_ID = "11111111-1111-1111-1111-111111111111";

// 유효 업로드 개수 기준 승인 가능 등급 (30개↑ 인증셀러, 50개↑ 프로셀러)
export const EVENT_GRADE_THRESHOLDS: { grade: "skilled" | "pro"; count: number }[] = [
  { grade: "skilled", count: 30 },
  { grade: "pro", count: 50 },
];
