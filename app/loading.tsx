import styles from "./page.module.css";
import { SkeletonCard, SkeletonTopCard } from "./components/SkeletonCard";

const ITEMS_PER_PAGE = 12;

// app/page.tsx(서버 컴포넌트)가 getHomeModelsBatch()를 기다리는 동안 Next.js가 자동으로
// 보여주는 스트리밍 로딩 셸. 헤더/푸터는 layout.tsx가 그대로 유지한다.
export default function HomeLoading() {
  return (
    <main className={styles.main}>
      <section className={styles.hero}>
        <div className={styles.heroOverlay} />
        <div className={styles.heroContent}>
          <p className={styles.heroTitle}>3D 마켓</p>
          <p className={styles.heroSubTitle}>주얼리 3D 모델 거래 플랫폼</p>
        </div>
      </section>

      <section style={{ marginTop: 18, marginBottom: 26 }}>
        <div style={{ display: "flex", alignItems: "end", gap: 12, marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 40, fontWeight: 900, color: "#111827", lineHeight: 1 }}>
            Best 6
          </h3>
        </div>
        <div className={styles.topGrid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonTopCard key={i} />
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.cardGrid}>
          {Array.from({ length: ITEMS_PER_PAGE }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </section>
    </main>
  );
}
