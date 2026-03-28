"use client";

import { useState } from "react";
import Link from "next/link";

/* ── 섹션/스텝 데이터 ─────────────────────────────── */
const SECTIONS = [
  {
    id: "search",
    label: "검색/구매",
    icon: "🔍",
    steps: [
      {
        title: "모델 검색하기",
        body: "홈 화면 상단 검색창에 원하는 키워드를 입력하거나,\n카테고리 버튼(RING · PENDANT · EARRING 등)을 눌러 원하는 모델을 찾으세요.",
        tip: "💡 인기 검색어: 반지, 목걸이, 귀걸이, 세트",
        image: "📂",
      },
      {
        title: "모델 상세 페이지 확인",
        body: "마음에 드는 모델 카드를 클릭하면 상세 페이지로 이동합니다.\n이미지 갤러리, 3D 미리보기, 포함 파일 형식을 꼭 확인하세요.",
        tip: "💡 STL · OBJ 형식은 브라우저에서 3D 미리보기가 가능합니다.",
        image: "🖼️",
      },
      {
        title: "구매하기 또는 장바구니 담기",
        body: "구매하기 버튼을 누르면 바로 결제 페이지로 이동합니다.\n장바구니 담기를 눌러 여러 모델을 한 번에 구매할 수도 있습니다.",
        tip: "💡 찜하기로 관심 모델을 저장해 두세요.",
        image: "🛒",
      },
      {
        title: "파일 다운로드",
        body: "결제 완료 후 상단 메뉴 [내 다운로드]에서 구매한 파일을\n언제든지 다시 다운로드할 수 있습니다.",
        tip: "💡 파일은 영구적으로 보관됩니다.",
        image: "⬇️",
        link: { href: "/library", label: "내 다운로드 바로가기 →" },
      },
    ],
  },
  {
    id: "payment",
    label: "결제",
    icon: "💳",
    steps: [
      {
        title: "결제 방법 선택",
        body: "상세 페이지에서 [구매하기]를 누르거나,\n장바구니에서 원하는 항목을 선택한 뒤 [결제하기]를 누르세요.",
        tip: "💡 신용카드 · 체크카드 · 카카오페이 · 토스페이 등 다양한 결제 수단을 지원합니다.",
        image: "💳",
      },
      {
        title: "구매자 정보 입력",
        body: "이름과 이메일 주소를 정확하게 입력해 주세요.\n결제 완료 안내와 영수증이 해당 이메일로 전송됩니다.",
        tip: "💡 이메일은 구매 내역 확인 및 환불 문의에 필요합니다.",
        image: "📝",
      },
      {
        title: "결제 완료 확인",
        body: "결제가 완료되면 완료 화면이 표시됩니다.\n[내 다운로드] 페이지로 자동 이동되어 파일을 바로 받을 수 있습니다.",
        tip: "💡 결제 오류 발생 시 고객센터 1:1 문의를 이용해 주세요.",
        image: "✅",
        link: { href: "/customer-service", label: "고객센터 문의하기 →" },
      },
    ],
  },
  {
    id: "3dview",
    label: "3D 보기",
    icon: "🧊",
    steps: [
      {
        title: "모델 상세 페이지로 이동",
        body: "홈 또는 검색 결과에서 모델 카드를 클릭하면\n상세 페이지로 이동합니다.",
        tip: "💡 STL · OBJ 형식의 파일만 3D 미리보기를 지원합니다.",
        image: "🔗",
      },
      {
        title: "[3D 보기] 버튼 클릭",
        body: "상세 페이지 상단 [3D 보기] 버튼을 클릭하세요.\n모바일에서는 전체 화면 팝업으로 열립니다.\nPC에서는 페이지 안에서 바로 3D 뷰어가 나타납니다.",
        tip: "💡 파일 크기에 따라 로딩에 수초가 걸릴 수 있습니다.",
        image: "🧊",
      },
      {
        title: "3D 모델 조작하기",
        body: "· 회전: 손가락 한 개(모바일) 또는 마우스 드래그(PC)\n· 확대·축소: 두 손가락 핀치(모바일) 또는 마우스 휠(PC)\n· 이동: 두 손가락 드래그(모바일) 또는 우클릭 드래그(PC)",
        tip: "💡 [뷰 초기화] 버튼으로 원래 각도로 돌아갈 수 있습니다.",
        image: "🖐️",
      },
      {
        title: "자동 회전 ON / OFF",
        body: "[자동회전 ON] 버튼을 누르면 모델이 자동으로 천천히 회전합니다.\n전체적인 형태를 확인할 때 편리합니다.",
        tip: "💡 모바일에서는 우측 상단 X 버튼으로 닫을 수 있습니다.",
        image: "🔄",
      },
    ],
  },
  {
    id: "upload",
    label: "업로드",
    icon: "📤",
    steps: [
      {
        title: "로그인 후 업로드 페이지 이동",
        body: "상단 MY 메뉴 → [업로드]를 클릭하거나,\n아래 버튼으로 바로 이동하세요.",
        tip: "💡 판매자 등록 없이 로그인만 하면 바로 업로드할 수 있습니다.",
        image: "📤",
        link: { href: "/upload", label: "업로드 페이지 바로가기 →" },
      },
      {
        title: "모델 정보 입력",
        body: "모델명, 카테고리, 가격, 설명을 입력하세요.\n설명에는 형상 특징, 사용 권장 소프트웨어, 해상도 등을 적어주면\n구매자에게 신뢰를 줄 수 있습니다.",
        tip: "💡 공통 템플릿 버튼으로 설명을 빠르게 작성할 수 있습니다.",
        image: "📝",
      },
      {
        title: "파일 업로드",
        body: "· 썸네일 이미지 1장 (필수)\n· 추가 이미지 최대 10장\n· 대표 모델 파일 1개 (STL · OBJ · 3DM)\n· 추가 파일 최대 10개 (ZIP · PDF 포함)",
        tip: "💡 썸네일은 밝고 선명한 렌더링 이미지를 사용하면 판매율이 높아집니다.",
        image: "📁",
      },
      {
        title: "업로드 완료 확인",
        body: "[업로드] 버튼을 누르면 저장이 시작됩니다.\n완료 후 [내 모델] 페이지로 이동되어 등록된 모델을 확인할 수 있습니다.",
        tip: "💡 판매 통계는 MY → 판매 통계에서 확인할 수 있습니다.",
        image: "🎉",
        link: { href: "/my-models", label: "내 모델 바로가기 →" },
      },
    ],
  },
  {
    id: "printer",
    label: "출력소 이용",
    icon: "🖨️",
    steps: [
      {
        title: "출력소 연동이란?",
        body: "구매한 3D 파일을 직접 출력소에 보내\n실물 주얼리로 제작할 수 있는 서비스입니다.\n모델 상세 페이지에서 [출력소로 보내기] 버튼을 이용하세요.",
        tip: "💡 캐스팅(귀금속 주조) 전문 출력소와 연동됩니다.",
        image: "🖨️",
      },
      {
        title: "파일 전송 및 소재 선택",
        body: "[출력소로 보내기] 버튼 클릭 후\n원하는 소재(레진, 왁스 등)와 수량을 선택하세요.\n출력소 담당자가 검토 후 견적을 안내합니다.",
        tip: "💡 출력 가능 여부는 모델 형상에 따라 달라질 수 있습니다.",
        image: "📐",
      },
      {
        title: "제작 진행 및 배송",
        body: "출력소 확인 후 제작이 진행됩니다.\n완성된 실물은 입력한 주소로 배송됩니다.\n제작 기간은 소재 및 형상에 따라 다릅니다.",
        tip: "💡 궁금한 점은 문의하기 또는 고객센터를 이용해 주세요.",
        image: "📦",
        link: { href: "/customer-service", label: "문의하기 →" },
      },
    ],
  },
  {
    id: "inquiry",
    label: "문의하기",
    icon: "💬",
    steps: [
      {
        title: "판매자에게 직접 문의",
        body: "모델 상세 페이지 하단 [문의하기] 버튼을 클릭하면\n해당 판매자와 1:1 채팅방이 생성됩니다.\n파일 관련 세부 사항, 맞춤 제작 등을 문의할 수 있습니다.",
        tip: "💡 로그인 후 이용 가능합니다.",
        image: "💬",
        link: { href: "/messages", label: "문의함 바로가기 →" },
      },
      {
        title: "문의함에서 대화 확인",
        body: "상단 메뉴 문의함(메일 아이콘) 또는 하단 탭 바에서\n진행 중인 모든 대화를 확인하고 답장할 수 있습니다.",
        tip: "💡 새 메시지가 오면 헤더 알림 아이콘에 배지가 표시됩니다.",
        image: "📬",
      },
      {
        title: "운영팀에게 1:1 문의",
        body: "결제 오류, 환불, 서비스 이용 불편 등\n운영팀에게 직접 문의하려면 고객센터를 이용하세요.\nMY 메뉴 → 고객센터 → 1:1 문의 섹션에서 작성하면\n담당자가 검토 후 답변을 등록합니다.",
        tip: "💡 평균 답변 시간: 영업일 기준 1~2일",
        image: "🎧",
        link: { href: "/customer-service", label: "고객센터 1:1 문의하기 →" },
      },
    ],
  },
];

export default function HelpPage() {
  const [activeSection, setActiveSection] = useState(0);
  const [activeStep, setActiveStep] = useState(0);
  const [animKey, setAnimKey] = useState(0);

  const section = SECTIONS[activeSection];
  const step = section.steps[activeStep];
  const totalSteps = section.steps.length;

  const goToSection = (idx: number) => {
    setActiveSection(idx);
    setActiveStep(0);
    setAnimKey((k) => k + 1);
  };

  const goToStep = (idx: number) => {
    setActiveStep(idx);
    setAnimKey((k) => k + 1);
  };

  return (
    <main style={{
      maxWidth: 800,
      margin: "0 auto",
      padding: "36px 20px 80px",
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      {/* 페이지 제목 */}
      <h1 style={{ margin: 0, fontSize: 38, fontWeight: 900, color: "#111827" }}>도움말</h1>
      <p style={{ margin: "10px 0 0", color: "#6b7280", fontSize: 18 }}>
        서비스 이용 방법을 단계별로 안내합니다.
      </p>

      {/* 섹션 탭 */}
      <div style={{
        marginTop: 28,
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
      }}>
        {SECTIONS.map((sec, idx) => (
          <button
            key={sec.id}
            type="button"
            onClick={() => goToSection(idx)}
            style={{
              height: 52,
              padding: "0 18px",
              borderRadius: 999,
              border: "none",
              fontWeight: 800,
              fontSize: 16,
              cursor: "pointer",
              transition: "all 0.15s ease",
              background: activeSection === idx ? "#111827" : "#f3f4f6",
              color: activeSection === idx ? "white" : "#374151",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span>{sec.icon}</span>
            <span>{sec.label}</span>
          </button>
        ))}
      </div>

      {/* STEP 진행 바 */}
      <div style={{
        marginTop: 28,
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}>
        {section.steps.map((_, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => goToStep(idx)}
            style={{
              flex: 1,
              height: 8,
              borderRadius: 999,
              border: "none",
              cursor: "pointer",
              background: idx === activeStep ? "#111827" : idx < activeStep ? "#9ca3af" : "#e5e7eb",
              transition: "background 0.2s ease",
              padding: 0,
            }}
            aria-label={"STEP " + (idx + 1)}
          />
        ))}
      </div>
      <div style={{ marginTop: 8, fontSize: 14, color: "#9ca3af", fontWeight: 700 }}>
        STEP {activeStep + 1} / {totalSteps}
      </div>

      {/* STEP 카드 */}
      <div
        key={animKey}
        style={{
          marginTop: 16,
          border: "1px solid #e5e7eb",
          borderRadius: 28,
          background: "white",
          padding: "36px 28px",
          animation: "helpFadeIn 0.28s ease",
          minHeight: 320,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div>
          {/* 이모지 + STEP 레이블 */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
            <div style={{
              width: 64, height: 64,
              borderRadius: 20,
              background: "#f8fafc",
              border: "1px solid #e5e7eb",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 32,
              flexShrink: 0,
            }}>
              {step.image}
            </div>
            <div>
              <div style={{
                display: "inline-flex", alignItems: "center",
                height: 28, padding: "0 12px",
                borderRadius: 999, background: "#111827",
                color: "white", fontSize: 13, fontWeight: 800,
                marginBottom: 6,
              }}>
                STEP {activeStep + 1}
              </div>
              <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#111827", lineHeight: 1.2 }}>
                {step.title}
              </h2>
            </div>
          </div>

          {/* 본문 */}
          <p style={{
            margin: 0,
            fontSize: 18,
            color: "#1f2937",
            lineHeight: 1.9,
            whiteSpace: "pre-line",
          }}>
            {step.body}
          </p>

          {/* 팁 */}
          {step.tip && (
            <div style={{
              marginTop: 20,
              padding: "14px 18px",
              borderRadius: 16,
              background: "#fffbeb",
              border: "1px solid #fde68a",
              fontSize: 16,
              color: "#92400e",
              fontWeight: 700,
              lineHeight: 1.6,
            }}>
              {step.tip}
            </div>
          )}

          {/* 링크 버튼 */}
          {step.link && (
            <Link
              href={step.link.href}
              style={{
                display: "inline-flex", alignItems: "center",
                marginTop: 18,
                height: 52, padding: "0 22px",
                borderRadius: 14,
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                color: "#16a34a",
                fontWeight: 800,
                fontSize: 16,
                textDecoration: "none",
              }}
            >
              {step.link.label}
            </Link>
          )}
        </div>

        {/* 이전 / 다음 버튼 */}
        <div style={{
          marginTop: 32,
          display: "flex",
          gap: 12,
          justifyContent: "space-between",
        }}>
          <button
            type="button"
            onClick={() => activeStep > 0 && goToStep(activeStep - 1)}
            disabled={activeStep === 0}
            style={{
              flex: 1,
              minHeight: 56,
              borderRadius: 16,
              border: "1px solid #d1d5db",
              background: activeStep === 0 ? "#f9fafb" : "white",
              color: activeStep === 0 ? "#d1d5db" : "#111827",
              fontWeight: 800,
              fontSize: 17,
              cursor: activeStep === 0 ? "default" : "pointer",
            }}
          >
            ← 이전
          </button>

          {activeStep < totalSteps - 1 ? (
            <button
              type="button"
              onClick={() => goToStep(activeStep + 1)}
              style={{
                flex: 1,
                minHeight: 56,
                borderRadius: 16,
                border: "none",
                background: "#111827",
                color: "white",
                fontWeight: 800,
                fontSize: 17,
                cursor: "pointer",
              }}
            >
              다음 →
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                const next = activeSection + 1;
                goToSection(next < SECTIONS.length ? next : 0);
              }}
              style={{
                flex: 1,
                minHeight: 56,
                borderRadius: 16,
                border: "none",
                background: "#16a34a",
                color: "white",
                fontWeight: 800,
                fontSize: 17,
                cursor: "pointer",
              }}
            >
              {activeSection < SECTIONS.length - 1
                ? "다음 단원: " + SECTIONS[activeSection + 1].label + " →"
                : "처음으로 돌아가기"}
            </button>
          )}
        </div>
      </div>

      {/* 스텝 도트 네비 */}
      <div style={{
        marginTop: 16,
        display: "flex",
        gap: 8,
        justifyContent: "center",
      }}>
        {section.steps.map((s, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => goToStep(idx)}
            title={s.title}
            style={{
              width: idx === activeStep ? 28 : 10,
              height: 10,
              borderRadius: 999,
              border: "none",
              background: idx === activeStep ? "#111827" : "#d1d5db",
              cursor: "pointer",
              padding: 0,
              transition: "all 0.2s ease",
            }}
          />
        ))}
      </div>

      {/* 하단 고객센터 링크 */}
      <div style={{
        marginTop: 40,
        padding: "28px 20px",
        borderRadius: 24,
        background: "#f8fafc",
        border: "1px solid #e5e7eb",
        textAlign: "center",
      }}>
        <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#374151" }}>
          원하는 답변을 찾지 못하셨나요?
        </p>
        <Link
          href="/customer-service"
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            marginTop: 14,
            minHeight: 56, padding: "0 28px",
            borderRadius: 16,
            background: "#111827",
            color: "white",
            fontWeight: 900,
            fontSize: 18,
            textDecoration: "none",
          }}
        >
          고객센터 1:1 문의하기
        </Link>
      </div>
    </main>
  );
}
