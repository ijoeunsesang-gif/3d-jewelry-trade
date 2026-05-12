"use client";

import { useState } from "react";
import Link from "next/link";

const GOLD = "#c9a84c";
const GOLD_LIGHT = "#fdf6e3";

type Tab = "feedback" | "session" | "package";

const TABS: { key: Tab; label: string; desc: string }[] = [
  { key: "feedback", label: "자유 피드백", desc: "포인트로 CAD 질문 · 전문가 답변" },
  { key: "session",  label: "건별 멘토링", desc: "1:1 맞춤 멘토링 단건 의뢰" },
  { key: "package",  label: "횟수제 멘토링", desc: "5회 · 10회 패키지 집중 학습" },
];

export default function CadSchoolPage() {
  const [tab, setTab] = useState<Tab>("feedback");

  return (
    <main
      style={{
        maxWidth: 860,
        margin: "0 auto",
        padding: "32px 20px 96px",
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      {/* 헤더 배너 */}
      <div
        style={{
          background: "#111827",
          borderRadius: 22,
          padding: "32px 36px",
          marginBottom: 28,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: GOLD, letterSpacing: 2, marginBottom: 8 }}>
            CAD SCHOOL
          </div>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 900, color: "white", lineHeight: 1.2 }}>
            캐드스쿨
          </h1>
          <p style={{ margin: "10px 0 0", fontSize: 14, color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>
            질문 · 피드백 · 1:1 멘토링까지<br />주얼리 CAD 실력을 키워보세요
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }}>
          <div
            style={{
              background: "rgba(201,168,76,0.15)",
              border: `1px solid ${GOLD}44`,
              borderRadius: 12,
              padding: "10px 16px",
              fontSize: 12,
              color: GOLD,
              fontWeight: 700,
              textAlign: "center",
              lineHeight: 1.7,
            }}
          >
            자유 피드백 질문 시 100P 차감<br />
            채택 답변 시 포인트 지급
          </div>
        </div>
      </div>

      {/* 탭 */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 24,
          background: "white",
          borderRadius: 16,
          padding: 6,
          border: "1px solid #e5e7eb",
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            style={{
              flex: 1,
              padding: "10px 8px",
              borderRadius: 12,
              border: "none",
              background: tab === t.key ? "#111827" : "transparent",
              color: tab === t.key ? "white" : "#6b7280",
              fontWeight: tab === t.key ? 800 : 600,
              fontSize: 13,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 탭 설명 */}
      <div
        style={{
          background: GOLD_LIGHT,
          border: `1px solid ${GOLD}55`,
          borderRadius: 12,
          padding: "10px 16px",
          fontSize: 13,
          color: "#92681a",
          fontWeight: 600,
          marginBottom: 20,
        }}
      >
        {TABS.find((t) => t.key === tab)?.desc}
      </div>

      {/* 자유 피드백 탭 */}
      {tab === "feedback" && <FeedbackTab />}

      {/* 건별 멘토링 탭 */}
      {tab === "session" && <SessionTab />}

      {/* 횟수제 멘토링 탭 */}
      {tab === "package" && <PackageTab />}
    </main>
  );
}

/* ── 자유 피드백 ─────────────────────────────────── */
function FeedbackTab() {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#111827" }}>자유 피드백 게시판</h2>
        <Link
          href="/cad-school/feedback/new"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "10px 20px",
            borderRadius: 12,
            background: GOLD,
            color: "white",
            fontWeight: 800,
            fontSize: 13,
            textDecoration: "none",
          }}
        >
          ✏️ 질문하기
        </Link>
      </div>

      {/* 포인트 안내 */}
      <div
        style={{
          background: "#f8fafc",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: "14px 18px",
          marginBottom: 20,
          fontSize: 12,
          color: "#6b7280",
          lineHeight: 1.8,
        }}
      >
        💡 질문 등록 시 <strong style={{ color: "#111827" }}>100P 차감</strong> ·
        답변 등록 시 <strong style={{ color: "#111827" }}>+5P</strong> ·
        채택 시 <strong style={{ color: GOLD }}>+20P</strong>
      </div>

      <EmptyState
        icon="💬"
        title="아직 게시글이 없습니다"
        desc="첫 번째 질문을 올려보세요!"
      />
    </div>
  );
}

/* ── 건별 멘토링 ─────────────────────────────────── */
function SessionTab() {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#111827" }}>멘토 목록</h2>
        <Link
          href="/cad-school/mentor/register"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "10px 20px",
            borderRadius: 12,
            background: "#111827",
            color: "white",
            fontWeight: 800,
            fontSize: 13,
            textDecoration: "none",
          }}
        >
          🎓 멘토 등록
        </Link>
      </div>

      <div
        style={{
          background: "#f8fafc",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: "14px 18px",
          marginBottom: 20,
          fontSize: 12,
          color: "#6b7280",
          lineHeight: 1.8,
        }}
      >
        💡 멘토를 선택해 1:1 멘토링을 의뢰하세요.
        멘토가 수락하면 파일을 공유하고 피드백을 받을 수 있습니다.
      </div>

      <EmptyState
        icon="🎓"
        title="등록된 멘토가 없습니다"
        desc="첫 번째 멘토로 등록해보세요!"
      />
    </div>
  );
}

/* ── 횟수제 멘토링 ───────────────────────────────── */
function PackageTab() {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#111827" }}>패키지 멘토링</h2>
        <Link
          href="/cad-school/mentor/register"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "10px 20px",
            borderRadius: 12,
            background: "#111827",
            color: "white",
            fontWeight: 800,
            fontSize: 13,
            textDecoration: "none",
          }}
        >
          🎓 멘토 등록
        </Link>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { type: "5회", desc: "집중 5회 피드백", color: "#f0fdf4", border: "#bbf7d0", text: "#15803d" },
          { type: "10회", desc: "심화 10회 멘토링", color: GOLD_LIGHT, border: `${GOLD}55`, text: "#92681a" },
        ].map((pkg) => (
          <div
            key={pkg.type}
            style={{
              flex: "1 1 200px",
              background: pkg.color,
              border: `1px solid ${pkg.border}`,
              borderRadius: 14,
              padding: "16px 18px",
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 900, color: pkg.text, marginBottom: 4 }}>
              {pkg.type} 패키지
            </div>
            <div style={{ fontSize: 12, color: pkg.text, opacity: 0.8 }}>{pkg.desc}</div>
          </div>
        ))}
      </div>

      <EmptyState
        icon="📦"
        title="구매한 패키지가 없습니다"
        desc="멘토를 선택해 패키지를 구매해보세요!"
      />
    </div>
  );
}

/* ── 공통 빈 상태 컴포넌트 ───────────────────────── */
function EmptyState({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div
      style={{
        background: "white",
        border: "1px solid #e5e7eb",
        borderRadius: 18,
        padding: "60px 20px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 40, marginBottom: 14 }}>{icon}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: "#111827", marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, color: "#9ca3af" }}>{desc}</div>
    </div>
  );
}
