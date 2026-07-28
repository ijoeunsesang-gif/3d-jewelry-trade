import HomeInner from "./components/HomeInner";
import { getHomeModelsBatch } from "./lib/getHomeModelsBatch";

// 홈 첫 화면(모델 목록)을 서버에서 미리 가져와 렌더한다.
// searchParams는 읽지 않는다 — 읽으면 필터/페이지 이동 시의 router.push/replace마다
// 이 서버 컴포넌트가 재실행되어 불필요한 네트워크 요청과 클라이언트 상태 초기화 위험이
// 생기므로, 항상 offset=0 기본 배치만 서버 렌더하고 나머지(검색/필터/정렬/페이지네이션)는
// 기존과 동일하게 클라이언트(HomeInner)가 이미 로드된 데이터 위에서 처리한다.
export default async function Home() {
  let initialModels: Awaited<ReturnType<typeof getHomeModelsBatch>>["models"] = [];
  let initialHasMore = false;

  try {
    const batch = await getHomeModelsBatch(0);
    initialModels = batch.models;
    initialHasMore = batch.hasMore;
  } catch (e) {
    console.error("[Home] 서버 모델 배치 조회 실패:", e);
    // 빈 배열로 폴백 — 클라이언트(HomeInner)가 마운트 시 자체 재시도한다.
  }

  return <HomeInner initialModels={initialModels} initialHasMore={initialHasMore} />;
}
