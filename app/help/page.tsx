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
        title: "원하는 모델 검색하기",
        body: "홈 화면 상단 검색창에 키워드(예: 반지, 목걸이, 귀걸이)를 입력하세요.\n또는 카테고리 버튼(RING · PENDANT · EARRING · BRACELET · SET)을\n눌러 종류별로 필터링할 수 있습니다.\n정렬 방식(최신순 · 인기순 · 가격순)도 변경할 수 있습니다.",
        tip: "💡 퀵뷰 버튼을 누르면 상세 페이지로 이동하지 않고 바로 미리보기가 가능합니다.",
        image: "🔍",
      },
      {
        title: "모델 카드 클릭 → 상세 확인",
        body: "마음에 드는 모델 카드를 클릭하면 상세 페이지로 이동합니다.\n\n확인할 항목:\n· 이미지 갤러리 (여러 장의 사진)\n· 3D 미리보기 (STL · OBJ 형식)\n· 포함 파일 종류 및 형식\n· 가격 및 판매자 정보",
        tip: "💡 STL · OBJ 파일은 브라우저에서 직접 3D 미리보기가 가능합니다.",
        image: "🖼️",
      },
      {
        title: "장바구니 담기",
        body: "상세 페이지에서 [장바구니 담기] 버튼을 눌러\n여러 모델을 한 번에 모아두세요.\n상단 메뉴 장바구니 아이콘을 누르면 담긴 목록을 확인할 수 있습니다.\n\n여러 모델을 한 번에 구매할 때 편리합니다.",
        tip: "💡 [찜하기]로 저장해두면 나중에 [찜] 목록에서 다시 볼 수 있습니다.",
        image: "🛒",
        link: { href: "/cart", label: "장바구니 바로가기 →" },
      },
      {
        title: "결제 후 파일 다운로드",
        body: "장바구니 또는 상세 페이지에서 결제를 완료하면\n[내 다운로드] 페이지에서 구매한 파일을 받을 수 있습니다.\n\n파일은 영구적으로 보관되며, 언제든지 다시 다운로드할 수 있습니다.",
        tip: "💡 결제 완료 후 자동으로 내 다운로드 페이지로 이동됩니다.",
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
        title: "장바구니에서 결제 시작",
        body: "상단 메뉴 장바구니 아이콘 또는 [장바구니 바로가기]를 누르세요.\n구매할 항목을 확인한 뒤 [결제하기] 버튼을 클릭합니다.\n\n단일 모델은 상세 페이지의 [구매하기] 버튼으로\n바로 결제할 수도 있습니다.",
        tip: "💡 장바구니에서 불필요한 항목을 삭제한 뒤 결제하세요.",
        image: "🛒",
        link: { href: "/cart", label: "장바구니 바로가기 →" },
      },
      {
        title: "구매자 정보 입력",
        body: "결제 페이지에서 이름과 이메일 주소를 입력해 주세요.\n\n· 이름: 주문자 확인용\n· 이메일: 결제 완료 안내 및 영수증 수신\n\n정확하게 입력해야 결제 내역 확인 및 환불 처리가 가능합니다.",
        tip: "💡 이메일은 향후 환불 · 문의 시 필요하니 정확히 입력하세요.",
        image: "📝",
      },
      {
        title: "카카오페이 · 카드로 결제",
        body: "결제 수단을 선택하세요:\n\n· 카카오페이: 카카오톡 앱에서 간편하게 결제\n· 신용카드 / 체크카드: 일반 카드 결제\n· 토스페이 등 기타 간편 결제 수단\n\n[결제하기] 버튼을 누르면 결제 창이 열립니다.",
        tip: "💡 카카오페이는 스마트폰 카카오톡이 설치되어 있어야 합니다.",
        image: "💳",
      },
      {
        title: "결제 완료 및 파일 수령",
        body: "결제가 성공적으로 완료되면 완료 화면이 표시됩니다.\n자동으로 [내 다운로드] 페이지로 이동되어\n구매한 파일을 즉시 다운로드할 수 있습니다.\n\n결제 확인 이메일이 입력한 주소로 발송됩니다.",
        tip: "💡 결제 오류가 발생하면 고객센터 1:1 문의로 연락해 주세요.",
        image: "✅",
        link: { href: "/library", label: "내 다운로드 바로가기 →" },
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
        body: "홈 또는 검색 결과에서 원하는 모델 카드를 클릭하면\n상세 페이지로 이동합니다.\n\n3D 미리보기는 STL · OBJ 형식 파일에서만 사용 가능합니다.\n(3DM 형식은 다운로드 후 Rhino 프로그램에서 확인하세요)",
        tip: "💡 상세 페이지 상단에 포함 파일 형식이 표시됩니다.",
        image: "🔗",
      },
      {
        title: "[3D 보기] 버튼 클릭",
        body: "상세 페이지 좌측 상단의 [3D 보기] 버튼을 클릭하세요.\n\n· 모바일: 화면 전체를 채우는 팝업이 열립니다.\n· PC: 페이지 안에서 바로 3D 뷰어가 나타납니다.\n\n파일 크기에 따라 로딩에 수초가 걸릴 수 있습니다.",
        tip: "💡 로딩 중에는 '3D 파일 준비 중...' 문구가 표시됩니다.",
        image: "🧊",
      },
      {
        title: "회전 · 확대 · 이동 조작법",
        body: "모델 조작 방법:\n\n· 회전: 손가락 하나로 드래그 (모바일)\n         마우스 왼쪽 버튼 드래그 (PC)\n\n· 확대/축소: 두 손가락 핀치 (모바일)\n               마우스 휠 스크롤 (PC)\n\n· 이동: 두 손가락 드래그 (모바일)\n         마우스 우클릭 드래그 (PC)",
        tip: "💡 [뷰 초기화] 버튼을 누르면 원래 각도와 크기로 돌아옵니다.",
        image: "🖐️",
      },
      {
        title: "자동회전 · 뷰어 닫기",
        body: "[자동회전 ON] 버튼을 누르면 모델이 천천히 자동 회전합니다.\n전체적인 형태를 편하게 확인할 때 유용합니다.\n\n모바일에서 팝업을 닫으려면\n우측 상단 X 버튼을 누르세요.",
        tip: "💡 자동회전 중에도 손가락으로 직접 조작할 수 있습니다.",
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
        title: "MY 메뉴 → [업로드] 클릭",
        body: "로그인 후 상단 MY 버튼을 클릭하면 드롭다운 메뉴가 열립니다.\n[업로드]를 선택하거나, 아래 바로가기 버튼을 이용하세요.\n\n별도의 판매자 등록 없이 로그인만 하면\n누구든지 바로 모델을 업로드하고 판매할 수 있습니다.",
        tip: "💡 판매 수익은 MY → 판매 통계에서 확인하고 정산 신청할 수 있습니다.",
        image: "📤",
        link: { href: "/upload", label: "업로드 페이지 바로가기 →" },
      },
      {
        title: "모델 정보 입력",
        body: "아래 항목을 빠짐없이 입력해 주세요:\n\n· 모델명: 검색에 잘 걸리도록 명확하게\n· 카테고리: RING · PENDANT · EARRING 중 선택\n· 가격: 숫자만 입력 (단위: 원)\n· 설명: 형상 특징, 권장 소프트웨어, 해상도 등\n\n[공통 템플릿] 버튼으로 설명 양식을 불러올 수 있습니다.",
        tip: "💡 설명이 자세할수록 구매 전환율이 높아집니다.",
        image: "📝",
      },
      {
        title: "이미지 · 파일 선택",
        body: "업로드할 파일을 선택하세요:\n\n· 썸네일 이미지 1장 (필수, JPG · PNG)\n· 추가 이미지 최대 10장 (상세 페이지 갤러리용)\n· 출력파일(대표) 1개 (STL · OBJ · 3DM)\n· 추가 파일 최대 10개 (ZIP · PDF 포함 가능)\n\n불필요한 파일은 X 버튼으로 제거할 수 있습니다.",
        tip: "💡 썸네일은 밝고 선명한 렌더링 이미지를 사용하면 클릭률이 높아집니다.",
        image: "📁",
      },
      {
        title: "업로드 완료 확인",
        body: "모든 정보 입력 후 하단 [업로드] 버튼을 클릭하세요.\n\n업로드가 완료되면 자동으로 [내 모델] 페이지로 이동됩니다.\n등록된 모델은 즉시 마켓플레이스에 공개됩니다.\n\n수정이 필요하면 내 모델 목록에서 [수정] 버튼을 이용하세요.",
        tip: "💡 판매 현황은 MY → 판매 통계에서 실시간으로 확인할 수 있습니다.",
        image: "🎉",
        link: { href: "/my-models", label: "내 모델 목록 바로가기 →" },
      },
    ],
  },
  {
    id: "printer",
    label: "출력소 이용",
    icon: "🖨️",
    steps: [
      {
        title: "내 다운로드에서 파일 받기",
        body: "구매한 3D 파일을 출력소에 전달하려면\n먼저 파일을 다운로드해야 합니다.\n\n상단 메뉴 [내 다운로드]를 클릭하거나\n하단 탭 바의 다운로드 아이콘을 누르세요.\n구매한 모델 목록에서 [다운로드] 버튼을 클릭하여 저장하세요.",
        tip: "💡 STL · OBJ · 3DM 형식 파일을 출력소에 전달합니다.",
        image: "⬇️",
        link: { href: "/library", label: "내 다운로드 바로가기 →" },
      },
      {
        title: "출력소에 파일 전달하기",
        body: "다운로드한 파일을 아래 방법으로 출력소에 전달하세요:\n\n방법 1. 이메일 전송\n출력소 담당자 이메일로 파일을 첨부하여 발송\n\n방법 2. 클라우드 링크 공유\nGoogle Drive · Dropbox 등에 업로드 후 링크 공유\n\n방법 3. USB 직접 전달\n가까운 출력소 방문 시 USB에 담아 전달",
        tip: "💡 출력소에 전달 전 파일 형식 · 단위(mm/inch) · 스케일을 반드시 확인하세요.",
        image: "📤",
      },
      {
        title: "출력 의뢰 및 제작 확인",
        body: "출력소에 아래 정보를 함께 알려주세요:\n\n· 원하는 소재: 왁스(왁스 캐스팅) · 레진 · 금속 등\n· 사이즈: 반지 호수 등 치수 정보\n· 수량 및 납기 일정\n\n출력소 담당자가 견적과 가능 여부를 안내합니다.\n완성된 실물은 방문 수령 또는 택배로 받을 수 있습니다.",
        tip: "💡 궁금한 점은 고객센터 또는 판매자에게 직접 문의하세요.",
        image: "🏭",
        link: { href: "/customer-service", label: "고객센터 문의하기 →" },
      },
    ],
  },
  {
    id: "install",
    label: "앱 설치",
    icon: "📱",
    steps: [],
  },
  {
    id: "inquiry",
    label: "문의하기",
    icon: "💬",
    steps: [
      {
        title: "판매자에게 직접 1:1 문의",
        body: "모델 상세 페이지 하단 [문의하기] 버튼을 클릭하면\n해당 판매자와 1:1 채팅방이 자동으로 생성됩니다.\n\n이런 내용을 문의할 수 있어요:\n· 파일 상세 스펙 및 형식 확인\n· 사이즈 수정 · 맞춤 제작 가능 여부\n· 기타 모델 관련 궁금한 사항",
        tip: "💡 로그인 후 이용 가능합니다. 본인 상품에는 문의할 수 없습니다.",
        image: "💬",
        link: { href: "/messages", label: "문의함 바로가기 →" },
      },
      {
        title: "문의함에서 대화 이어가기",
        body: "상단 메뉴 문의함(메일 아이콘) 또는\n모바일 하단 탭 바 문의함 아이콘을 누르세요.\n\n진행 중인 모든 대화 목록이 표시됩니다.\n원하는 대화를 선택하면 채팅 화면으로 이동합니다.\n\n새 메시지가 오면 헤더 알림에 숫자 배지가 표시됩니다.",
        tip: "💡 답장은 텍스트 입력 후 [보내기] 버튼 또는 Enter 키로 전송합니다.",
        image: "📬",
      },
      {
        title: "고객센터 이용하기",
        body: "결제 오류 · 환불 · 서비스 불편 · 기타 문의는\n고객센터를 이용해 주세요.\n\n이용 방법:\n① 상단 MY 메뉴 → [고객센터] 클릭\n② 또는 상단 헤드폰 아이콘 클릭\n③ 페이지 하단 [1:1 문의] 섹션에서 제목과 내용 작성 후 [문의 전송]\n\n담당자가 확인 후 답변을 등록합니다.",
        tip: "💡 평균 답변 시간: 영업일 기준 1~2일",
        image: "🎧",
        link: { href: "/customer-service", label: "고객센터 1:1 문의하기 →" },
      },
    ],
  },
];

/* ── 섹션별 강조색 ── */
const SECTION_COLORS = ["#3b82f6","#f59e0b","#8b5cf6","#10b981","#c9a84c","#f97316","#ec4899"];
const SECTION_BG    = ["#eff6ff","#fffbeb","#f5f3ff","#ecfdf5","#fdf8ec","#fff7ed","#fdf2f8"];

const INSTALL_SECTION_ID = "install";

const IOS_STEPS = [
  { icon: "🌐", label: "Safari로 접속", desc: "반드시 Safari 브라우저를 사용해야 합니다." },
  { icon: "□↑", label: "하단 공유 버튼 탭", desc: "화면 하단 가운데의 공유 버튼(□↑)을 누르세요." },
  { icon: "➕", label: "\"홈 화면에 추가\" 선택", desc: "공유 메뉴에서 스크롤하여 \"홈 화면에 추가\"를 찾아 누르세요." },
  { icon: "✅", label: "\"추가\" 클릭", desc: "우측 상단 \"추가\" 버튼을 눌러 완료하세요." },
];

const ANDROID_STEPS = [
  { icon: "🌐", label: "Chrome으로 접속", desc: "반드시 Chrome 브라우저를 사용해야 합니다." },
  { icon: "⋮", label: "우측 상단 메뉴 탭", desc: "주소창 오른쪽 끝 메뉴(⋮) 버튼을 누르세요." },
  { icon: "➕", label: "\"홈 화면에 추가\" 선택", desc: "메뉴에서 \"홈 화면에 추가\"를 누르세요." },
];

export default function HelpPage() {
  const [activeSection, setActiveSection] = useState(0);
  const [activeStep, setActiveStep] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const [installTab, setInstallTab] = useState<"ios" | "android">("ios");

  const section   = SECTIONS[activeSection];
  const isInstall = section.id === INSTALL_SECTION_ID;
  const step      = !isInstall ? section.steps[activeStep] : null;
  const totalSteps = section.steps.length;
  const accent    = SECTION_COLORS[activeSection];
  const accentBg  = SECTION_BG[activeSection];

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
      padding: "32px 16px 96px",
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      background: "#f8fafc",
      minHeight: "100vh",
    }}>

      {/* ── 페이지 제목 ── */}
      <div style={{
        background: "white",
        borderRadius: 24,
        padding: "28px 24px 24px",
        border: "1px solid #e5e7eb",
        marginBottom: 20,
      }}>
        <h1 style={{ margin: 0, fontSize: 36, fontWeight: 900, color: "#111827", lineHeight: 1.15 }}>
          도움말 안내
        </h1>
        <p style={{ margin: "10px 0 0", color: "#4b5563", fontSize: 18, lineHeight: 1.6 }}>
          아래 항목을 선택하면 단계별로 이용 방법을 안내합니다.
        </p>
      </div>

      {/* ── 섹션 탭 (가로 스크롤) ── */}
      <div style={{
        display: "flex",
        gap: 10,
        overflowX: "auto",
        paddingBottom: 4,
        scrollbarWidth: "none",
        WebkitOverflowScrolling: "touch",
      } as React.CSSProperties}>
        {SECTIONS.map((sec, idx) => {
          const on = activeSection === idx;
          return (
            <button
              key={sec.id}
              type="button"
              onClick={() => goToSection(idx)}
              style={{
                flexShrink: 0,
                height: 60,
                padding: "0 22px",
                borderRadius: 18,
                border: on ? "none" : "2px solid #e5e7eb",
                fontWeight: 800,
                fontSize: 17,
                cursor: "pointer",
                transition: "all 0.15s ease",
                background: on ? SECTION_COLORS[idx] : "white",
                color: on ? "white" : "#374151",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                boxShadow: on ? "0 4px 14px rgba(0,0,0,0.15)" : "none",
              }}
            >
              <span style={{ fontSize: 22 }}>{sec.icon}</span>
              <span>{sec.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── STEP 진행 바 (install 섹션 제외) ── */}
      {!isInstall && (
        <div style={{
          marginTop: 20,
          background: "white",
          borderRadius: 20,
          padding: "18px 20px",
          border: "1px solid #e5e7eb",
        }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {section.steps.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => goToStep(idx)}
                style={{
                  flex: 1, height: 12,
                  borderRadius: 999, border: "none", padding: 0,
                  cursor: "pointer",
                  background: idx === activeStep ? accent
                    : idx < activeStep ? "#9ca3af" : "#e5e7eb",
                  transition: "background 0.25s ease",
                }}
                aria-label={"STEP " + (idx + 1)}
              />
            ))}
          </div>
          <div style={{
            marginTop: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}>
            <span style={{
              fontSize: 15, fontWeight: 800, color: "#111827",
              background: accentBg,
              padding: "4px 12px", borderRadius: 999,
              border: "1px solid " + accent + "44",
            }}>
              STEP {activeStep + 1} / {totalSteps}
            </span>
            <span style={{ fontSize: 15, color: "#6b7280", fontWeight: 600 }}>
              {step!.title}
            </span>
          </div>
        </div>
      )}

      {/* ── 앱 설치 탭 UI ── */}
      {isInstall && (
        <div style={{ marginTop: 20 }}>
          {/* 헤더 */}
          <div style={{
            background: "#111827",
            borderRadius: "24px 24px 0 0",
            padding: "28px 24px 24px",
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}>
            <div style={{
              width: 72, height: 72,
              borderRadius: 20,
              background: "#c9a84c",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 36,
              flexShrink: 0,
              boxShadow: "0 4px 16px rgba(201,168,76,0.4)",
            }}>
              📱
            </div>
            <div>
              <div style={{
                display: "inline-flex", alignItems: "center",
                height: 28, padding: "0 12px",
                borderRadius: 999,
                background: "#c9a84c",
                color: "#111827", fontSize: 13, fontWeight: 900,
                marginBottom: 8,
                letterSpacing: "0.06em",
              }}>
                PWA
              </div>
              <h2 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: "white", lineHeight: 1.25 }}>
                앱으로 설치하기
              </h2>
              <p style={{ margin: "6px 0 0", fontSize: 15, color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>
                홈 화면에 추가하면 앱처럼 빠르게 실행할 수 있어요
              </p>
            </div>
          </div>

          {/* 탭 선택 */}
          <div style={{
            background: "#1f2937",
            padding: "0 24px",
            display: "flex",
            gap: 0,
          }}>
            {([
              { key: "ios", label: "iPhone", emoji: "🍎" },
              { key: "android", label: "Android", emoji: "🤖" },
            ] as const).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setInstallTab(t.key)}
                style={{
                  flex: 1,
                  height: 56,
                  border: "none",
                  borderBottom: installTab === t.key ? "3px solid #c9a84c" : "3px solid transparent",
                  background: "transparent",
                  color: installTab === t.key ? "#c9a84c" : "rgba(255,255,255,0.45)",
                  fontWeight: 900,
                  fontSize: 17,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  transition: "all 0.15s ease",
                  letterSpacing: "0.02em",
                }}
              >
                <span style={{ fontSize: 22 }}>{t.emoji}</span>
                {t.label}
              </button>
            ))}
          </div>

          {/* 탭 콘텐츠 */}
          <div style={{
            background: "white",
            borderRadius: "0 0 24px 24px",
            border: "1px solid #e5e7eb",
            borderTop: "none",
            padding: "28px 24px 32px",
          }}>
            {installTab === "ios" ? (
              <>
                <div style={{
                  display: "flex", alignItems: "center", gap: 10,
                  marginBottom: 24,
                  padding: "14px 18px",
                  borderRadius: 14,
                  background: "#fdf8ec",
                  border: "1px solid #c9a84c44",
                }}>
                  <span style={{ fontSize: 20 }}>⚠️</span>
                  <span style={{ fontSize: 15, color: "#78350f", fontWeight: 700 }}>
                    반드시 <strong>Safari</strong> 브라우저에서만 설치 가능합니다.
                  </span>
                </div>
                {IOS_STEPS.map((s, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "flex-start", gap: 16,
                    marginBottom: i < IOS_STEPS.length - 1 ? 20 : 0,
                  }}>
                    <div style={{
                      flexShrink: 0,
                      width: 44, height: 44,
                      borderRadius: 14,
                      background: "#111827",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
                    }}>
                      <span style={{
                        fontSize: i === 1 ? 13 : 20,
                        color: "#c9a84c",
                        fontWeight: 900,
                        letterSpacing: "-0.5px",
                      }}>{s.icon}</span>
                    </div>
                    <div style={{ paddingTop: 4 }}>
                      <div style={{
                        display: "inline-flex", alignItems: "center",
                        height: 22, padding: "0 10px",
                        borderRadius: 999,
                        background: "#c9a84c",
                        color: "white", fontSize: 12, fontWeight: 900,
                        marginBottom: 6,
                      }}>
                        {i + 1}단계
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: "#111827", marginBottom: 4 }}>
                        {s.label}
                      </div>
                      <div style={{ fontSize: 15, color: "#6b7280", fontWeight: 500, lineHeight: 1.6 }}>
                        {s.desc}
                      </div>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <>
                <div style={{
                  display: "flex", alignItems: "center", gap: 10,
                  marginBottom: 24,
                  padding: "14px 18px",
                  borderRadius: 14,
                  background: "#fdf8ec",
                  border: "1px solid #c9a84c44",
                }}>
                  <span style={{ fontSize: 20 }}>⚠️</span>
                  <span style={{ fontSize: 15, color: "#78350f", fontWeight: 700 }}>
                    반드시 <strong>Chrome</strong> 브라우저에서만 설치 가능합니다.
                  </span>
                </div>
                {ANDROID_STEPS.map((s, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "flex-start", gap: 16,
                    marginBottom: i < ANDROID_STEPS.length - 1 ? 20 : 0,
                  }}>
                    <div style={{
                      flexShrink: 0,
                      width: 44, height: 44,
                      borderRadius: 14,
                      background: "#111827",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
                    }}>
                      <span style={{
                        fontSize: i === 1 ? 18 : 20,
                        color: "#c9a84c",
                        fontWeight: 900,
                      }}>{s.icon}</span>
                    </div>
                    <div style={{ paddingTop: 4 }}>
                      <div style={{
                        display: "inline-flex", alignItems: "center",
                        height: 22, padding: "0 10px",
                        borderRadius: 999,
                        background: "#c9a84c",
                        color: "white", fontSize: 12, fontWeight: 900,
                        marginBottom: 6,
                      }}>
                        {i + 1}단계
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: "#111827", marginBottom: 4 }}>
                        {s.label}
                      </div>
                      <div style={{ fontSize: 15, color: "#6b7280", fontWeight: 500, lineHeight: 1.6 }}>
                        {s.desc}
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* 완료 안내 */}
            <div style={{
              marginTop: 28,
              padding: "20px 20px",
              borderRadius: 18,
              background: "#111827",
              border: "none",
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}>
              <span style={{ fontSize: 32, flexShrink: 0 }}>🎉</span>
              <div>
                <div style={{ fontSize: 16, fontWeight: 900, color: "#c9a84c", marginBottom: 4 }}>
                  설치 완료!
                </div>
                <div style={{ fontSize: 14, color: "rgba(255,255,255,0.75)", fontWeight: 500, lineHeight: 1.6 }}>
                  홈 화면 아이콘을 탭하면 앱처럼 바로 실행됩니다.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 카드 (install 섹션 제외) ── */}
      {!isInstall && (
        <div
          key={animKey}
          style={{
            marginTop: 14,
            border: "1px solid #e5e7eb",
            borderRadius: 28,
            background: "white",
            overflow: "hidden",
            animation: "helpFadeIn 0.28s ease",
          }}
        >
          {/* 카드 헤더 (컬러 배경) */}
          <div style={{
            background: accentBg,
            borderBottom: "1px solid " + accent + "33",
            padding: "24px 24px 20px",
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}>
            <div style={{
              width: 76, height: 76,
              borderRadius: 22,
              background: "white",
              border: "2px solid " + accent + "44",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 38,
              flexShrink: 0,
              boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
            }}>
              {step!.image}
            </div>
            <div>
              <div style={{
                display: "inline-flex", alignItems: "center",
                height: 32, padding: "0 14px",
                borderRadius: 999,
                background: accent,
                color: "white", fontSize: 14, fontWeight: 900,
                marginBottom: 8,
                letterSpacing: "0.04em",
              }}>
                STEP {activeStep + 1}
              </div>
              <h2 style={{
                margin: 0,
                fontSize: 26,
                fontWeight: 900,
                color: "#111827",
                lineHeight: 1.25,
              }}>
                {step!.title}
              </h2>
            </div>
          </div>

          {/* 카드 본문 */}
          <div style={{ padding: "28px 24px 32px" }}>
            <p style={{
              margin: 0,
              fontSize: 19,
              color: "#1f2937",
              lineHeight: 2.0,
              whiteSpace: "pre-line",
              fontWeight: 500,
            }}>
              {step!.body}
            </p>

            {/* 팁 박스 */}
            {step!.tip && (
              <div style={{
                marginTop: 24,
                padding: "18px 20px",
                borderRadius: 18,
                background: "#fffbeb",
                border: "2px solid #fcd34d",
                fontSize: 18,
                color: "#78350f",
                fontWeight: 700,
                lineHeight: 1.7,
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
              }}>
                <span style={{ fontSize: 22, lineHeight: 1.4, flexShrink: 0 }}>💡</span>
                <span>{step!.tip.replace("💡 ", "")}</span>
              </div>
            )}

            {/* 바로가기 버튼 */}
            {step!.link && (
              <Link
                href={step!.link.href}
                style={{
                  display: "inline-flex", alignItems: "center",
                  marginTop: 20,
                  minHeight: 56, padding: "0 26px",
                  borderRadius: 16,
                  background: "#ecfdf5",
                  border: "2px solid #6ee7b7",
                  color: "#065f46",
                  fontWeight: 800,
                  fontSize: 18,
                  textDecoration: "none",
                  gap: 6,
                }}
              >
                {step!.link.label}
              </Link>
            )}

            {/* ── 이전 / 다음 버튼 ── */}
            <div style={{
              marginTop: 32,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
            }}>
              <button
                type="button"
                onClick={() => activeStep > 0 && goToStep(activeStep - 1)}
                disabled={activeStep === 0}
                style={{
                  minHeight: 60,
                  borderRadius: 18,
                  border: "2px solid " + (activeStep === 0 ? "#e5e7eb" : "#d1d5db"),
                  background: activeStep === 0 ? "#f9fafb" : "white",
                  color: activeStep === 0 ? "#d1d5db" : "#111827",
                  fontWeight: 900,
                  fontSize: 18,
                  cursor: activeStep === 0 ? "default" : "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                ← 이전
              </button>

              {activeStep < totalSteps - 1 ? (
                <button
                  type="button"
                  onClick={() => goToStep(activeStep + 1)}
                  style={{
                    minHeight: 60,
                    borderRadius: 18,
                    border: "none",
                    background: accent,
                    color: "white",
                    fontWeight: 900,
                    fontSize: 18,
                    cursor: "pointer",
                    boxShadow: "0 4px 14px rgba(0,0,0,0.14)",
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
                    minHeight: 60,
                    borderRadius: 18,
                    border: "none",
                    background: "#16a34a",
                    color: "white",
                    fontWeight: 900,
                    fontSize: 17,
                    cursor: "pointer",
                    boxShadow: "0 4px 14px rgba(0,0,0,0.14)",
                    lineHeight: 1.3,
                    padding: "0 12px",
                  }}
                >
                  {activeSection < SECTIONS.length - 1
                    ? SECTIONS[activeSection + 1].icon + " " + SECTIONS[activeSection + 1].label + " →"
                    : "처음으로 돌아가기"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 도트 네비 (install 섹션 제외) ── */}
      {!isInstall && (
        <div style={{
          marginTop: 18,
          display: "flex",
          gap: 10,
          justifyContent: "center",
          alignItems: "center",
        }}>
          {section.steps.map((s, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => goToStep(idx)}
              title={s.title}
              style={{
                width: idx === activeStep ? 36 : 14,
                height: 14,
                borderRadius: 999,
                border: "none",
                background: idx === activeStep ? accent : "#d1d5db",
                cursor: "pointer",
                padding: 0,
                transition: "all 0.22s ease",
              }}
            />
          ))}
        </div>
      )}

      {/* ── 하단 고객센터 CTA ── */}
      <div style={{
        marginTop: 36,
        padding: "32px 24px",
        borderRadius: 24,
        background: "#111827",
        textAlign: "center",
      }}>
        <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "white", lineHeight: 1.5 }}>
          원하는 답변을 찾지 못하셨나요?
        </p>
        <p style={{ margin: "8px 0 0", fontSize: 17, color: "rgba(255,255,255,0.7)" }}>
          운영팀이 직접 답변해 드립니다.
        </p>
        <Link
          href="/customer-service"
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            marginTop: 20,
            minHeight: 60, padding: "0 36px",
            borderRadius: 18,
            background: "#c9a84c",
            color: "white",
            fontWeight: 900,
            fontSize: 19,
            textDecoration: "none",
            boxShadow: "0 4px 16px rgba(201,168,76,0.5)",
          }}
        >
          고객센터 1:1 문의하기
        </Link>
      </div>

    </main>
  );
}
