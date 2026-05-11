// 페이지 변경 후 React 리렌더링이 완료되기 전에 스크롤하면
// 이미 해당 위치로 간주해 무시되므로 100ms 지연 후 실행
// iOS Safari PWA 등 다양한 환경에서 window 대신
// document.documentElement / document.body에 걸리는 경우를 함께 대응
export function scrollToTop() {
  setTimeout(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    document.documentElement.scrollTo({ top: 0, behavior: "smooth" });
    document.body.scrollTo({ top: 0, behavior: "smooth" });
  }, 100);
}

export function scrollToSection(id: string) {
  setTimeout(() => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
      document.documentElement.scrollTo({ top: 0, behavior: "smooth" });
      document.body.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, 100);
}
