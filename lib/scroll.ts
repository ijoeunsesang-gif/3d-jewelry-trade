// iOS Safari PWA 등 다양한 환경에서 스크롤이 window 대신
// document.documentElement / document.body에 걸리는 경우를 대응
export function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
  document.documentElement.scrollTo({ top: 0, behavior: "smooth" });
  document.body.scrollTo({ top: 0, behavior: "smooth" });
}

export function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.pageYOffset;
  window.scrollTo({ top, behavior: "smooth" });
  document.documentElement.scrollTo({ top, behavior: "smooth" });
  document.body.scrollTo({ top, behavior: "smooth" });
}
