type ModelViewerModule = typeof import("@/app/components/ModelViewer");

let importPromise: Promise<ModelViewerModule> | null = null;

// ModelViewer(three.js + @react-three/fiber + drei, ~950KB)는 dynamic import로 지연
// 로딩된다. 기존에는 "뷰어 URL 인증 API 응답 → 그제서야 청크 다운로드 시작"으로 완전
// 직렬이었는데, 이 함수를 뷰어를 열려는 시점(클릭)이나 그 전(hover)에 먼저 호출해
// import()를 API 호출과 병렬로 미리 시작시킨다.
// 이미 시작됐으면(importPromise 존재) 새 요청 없이 같은 프로미스를 그대로 반환한다 —
// 여러 카드에서 hover/click이 겹쳐도 청크는 한 번만 받는다.
export function preloadModelViewer(): Promise<ModelViewerModule> {
  if (!importPromise) {
    importPromise = import("@/app/components/ModelViewer");
  }
  return importPromise;
}
