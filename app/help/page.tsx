"use client";

import { useState } from "react";
import Link from "next/link";

type TextBlock   = { type: "text";     body: string };
type TipBlock    = { type: "tip";      body: string };
type StepItem    = { icon: string; label: string; desc: string };
type StepsBlock  = { type: "steps";    items: StepItem[] };
type CardItem    = { icon: string; label: string; desc: string };
type CardsBlock  = { type: "cards";    items: CardItem[] };
type RevisionItem = {
  tag: string; tagColor: string; tagBg: string;
  icon: string; label: string; desc: string;
  okTitle?: string; ok?: string[];
  noTitle?: string; no?: string[];
  flow?: string[];
};
type RevisionBlock = { type: "revision"; items: RevisionItem[] };
type InstallBlock  = { type: "install" };
type ContentBlock  = TextBlock | TipBlock | StepsBlock | CardsBlock | RevisionBlock | InstallBlock;

type SectionDef = { icon: string; title: string; summary: string; content: ContentBlock[] };

const SECTIONS = ([
  {
    icon: "👤",
    title: "회원가입 / 로그인",
    summary: "카카오 또는 구글 계정으로 간편하게 시작하세요",
    content: [
      {
        type: "text",
        body: "별도 회원가입 없이 카카오 또는 구글 계정으로 바로 로그인할 수 있습니다.",
      },
      {
        type: "steps",
        items: [
          { icon: "📱", label: "카카오로 로그인", desc: "카카오톡 계정으로 1초 만에 로그인" },
          { icon: "🔵", label: "구글로 로그인", desc: "Gmail 계정으로 간편하게 로그인" },
        ],
      },
      {
        type: "tip",
        body: "이미 사용 중인 카카오 또는 구글 계정을 그대로 사용하면 됩니다. 비밀번호를 따로 만들 필요가 없습니다.",
      },
    ],
  },
  {
    icon: "🛒",
    title: "상품 구매 방법",
    summary: "원하는 3D 모델을 선택하고 바로 다운로드하세요",
    content: [
      {
        type: "steps",
        items: [
          { icon: "🔍", label: "상품 선택", desc: "홈 화면에서 원하는 3D 모델을 찾아 클릭하세요" },
          { icon: "🛒", label: "장바구니 또는 바로구매", desc: "여러 개를 모아 결제하거나 바로 구매할 수 있습니다" },
          { icon: "💳", label: "결제", desc: "카카오페이, 신용카드 등으로 간편하게 결제" },
          { icon: "⬇️", label: "파일 다운로드", desc: "결제 완료 후 내 다운로드 페이지에서 파일을 받으세요" },
        ],
      },
      {
        type: "tip",
        body: "구매한 파일은 6개월간 보관되며 기간 내 언제든지 다시 다운로드할 수 있습니다.",
      },
    ],
  },
  {
    icon: "📋",
    title: "의뢰 등록 방법",
    summary: "원하는 디자인을 전문 판매자에게 의뢰하세요",
    content: [
      {
        type: "text",
        body: "의뢰는 두 가지 방식으로 등록할 수 있습니다.",
      },
      {
        type: "cards",
        items: [
          {
            icon: "🌐",
            label: "공개의뢰",
            desc: "저렴한 가격으로 제품을 제작할 수 있습니다. 단, 다른 사람도 구매가 가능합니다.",
          },
          {
            icon: "🎯",
            label: "개인의뢰",
            desc: "특정 판매자를 직접 지정하거나, 미지정 의뢰 후 신청한 판매자를 선택해 의뢰할 수 있습니다. 원하는 디자이너에게 맞춤 의뢰가 가능합니다. 단, 다른 사람이 구매를 못하는 대신 비용이 공개의뢰만큼 저렴하지는 않습니다.",
          },
        ],
      },
    ],
  },
  {
    icon: "✏️",
    title: "수정요청 방법",
    summary: "작업 결과물에 수정이 필요할 때 이용하세요",
    content: [
      {
        type: "text",
        body: "수정요청은 두 가지 종류가 있습니다.",
      },
      {
        type: "revision",
        items: [
          {
            tag: "무료",
            tagColor: "#16a34a",
            tagBg: "#dcfce7",
            icon: "✅",
            label: "문제수정",
            desc: "작업 결과물의 기술적인 문제를 무료로 수정 요청합니다.",
            okTitle: "문제수정 가능 항목",
            ok: [
              "알 물림이 안되는 경우",
              "조립이 안되는 경우",
              "두께가 얇아서 주물이 안나오는 경우",
              "이미지 컨펌을 하지 않고 링크가 달렸을 경우 외형 변경 가능",
            ],
            noTitle: "문제수정 불가 항목 (추가수정으로 요청)",
            no: [
              "이미지 컨펌 후 전체적인 라인 변경",
              "민자 ↔ 알세팅 또는 알세팅 관련 변경",
            ],
          },
          {
            tag: "비용부담",
            tagColor: "#92400e",
            tagBg: "#fef3c7",
            icon: "💰",
            label: "추가수정",
            desc: "추가 작업이 필요한 경우 판매자와 비용 및 기간을 협의한 후 진행합니다. 이미지 첨부를 통해 원하는 내용을 구체적으로 전달할 수 있습니다.",
            flow: [
              "의뢰자가 내용 + 이미지 첨부하여 요청",
              "판매자가 추가 비용/기간 제안",
              "의뢰자가 수락 또는 협의 요청 (1회)",
              "최종 수락 후 작업 진행",
            ],
          },
        ],
      },
    ],
  },
  {
    icon: "📱",
    title: "앱으로 설치하기",
    summary: "홈 화면에 추가하면 앱처럼 빠르게 실행됩니다",
    content: [
      {
        type: "install",
      },
    ],
  },
  {
    icon: "💳",
    title: "결제 / 환불 안내",
    summary: "결제 수단과 환불 정책을 확인하세요",
    content: [
      {
        type: "cards",
        items: [
          {
            icon: "💳",
            label: "결제 수단",
            desc: "토스페이먼츠를 통해 신용카드, 체크카드, 카카오페이, 토스페이 등 다양한 결제 수단을 지원합니다.",
          },
          {
            icon: "↩️",
            label: "환불 안내",
            desc: "작업 시작 전에는 취소 및 환불이 가능합니다. 작업이 시작된 이후에는 환불이 불가합니다.",
          },
        ],
      },
      {
        type: "tip",
        body: "환불이 필요하신 경우 고객센터 1:1 문의를 통해 접수해 주세요.",
      },
    ],
  },
  {
    icon: "🏪",
    title: "판매자 신청 방법",
    summary: "나만의 3D 모델을 판매하고 수익을 올려보세요",
    content: [
      {
        type: "steps",
        items: [
          { icon: "👤", label: "프로필 이동", desc: "상단 메뉴에서 내 프로필 페이지로 이동합니다" },
          { icon: "📝", label: "판매자 신청", desc: "판매자 신청 버튼을 눌러 신청서를 작성합니다" },
          { icon: "✅", label: "승인 후 판매 시작", desc: "자동 승인 후 즉시 모델 업로드 및 판매가 가능합니다" },
        ],
      },
      {
        type: "tip",
        body: "신청 즉시 자동 승인되며 승인 완료 시 알림이 발송됩니다.",
      },
    ],
  },
] satisfies SectionDef[]);

function InstallContent() {
  const [tab, setTab] = useState<"ios" | "android">("ios");

  const iosSteps = [
    { icon: "🌐", label: "Safari로 접속", desc: "반드시 Safari 브라우저를 사용해야 합니다." },
    { icon: "□↑", label: "하단 공유 버튼 탭", desc: "화면 하단 가운데의 공유 버튼(□↑)을 누르세요." },
    { icon: "➕", label: '"홈 화면에 추가" 선택', desc: '공유 메뉴에서 "홈 화면에 추가"를 찾아 누르세요.' },
    { icon: "✅", label: '"추가" 클릭', desc: '우측 상단 "추가" 버튼을 눌러 완료합니다.' },
  ];
  const androidSteps = [
    { icon: "🌐", label: "Chrome으로 접속", desc: "반드시 Chrome 브라우저를 사용해야 합니다." },
    { icon: "⋮", label: "우측 상단 메뉴 탭", desc: "주소창 오른쪽 끝 메뉴(⋮) 버튼을 누르세요." },
    { icon: "➕", label: '"홈 화면에 추가" 선택', desc: '메뉴에서 "홈 화면에 추가"를 누릅니다.' },
  ];

  const steps = tab === "ios" ? iosSteps : androidSteps;
  const browserName = tab === "ios" ? "Safari" : "Chrome";

  return (
    <div>
      {/* 탭 선택 */}
      <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
        {(["ios", "android"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            style={{
              flex: 1, height: 52, borderRadius: 14,
              border: tab === t ? "none" : "2px solid #e5e7eb",
              background: tab === t ? "#111827" : "white",
              color: tab === t ? "#c9a84c" : "#6b7280",
              fontWeight: 800, fontSize: 17, cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {t === "ios" ? "🍎 iPhone" : "🤖 Android"}
          </button>
        ))}
      </div>

      {/* 경고 */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "14px 18px", borderRadius: 14,
        background: "#fdf8ec", border: "1px solid #c9a84c44",
        marginBottom: 24,
      }}>
        <span style={{ fontSize: 20 }}>⚠️</span>
        <span style={{ fontSize: 16, color: "#78350f", fontWeight: 700 }}>
          반드시 <strong>{browserName}</strong> 브라우저에서만 설치 가능합니다.
        </span>
      </div>

      {/* 단계별 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
            <div style={{
              flexShrink: 0, width: 40, height: 40,
              borderRadius: 12, background: "#111827",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{
                fontSize: i === 1 && tab === "ios" ? 13 : 18,
                color: "#c9a84c", fontWeight: 900,
              }}>{s.icon}</span>
            </div>
            <div>
              <div style={{
                display: "inline-block", padding: "2px 10px",
                borderRadius: 999, background: "#c9a84c",
                color: "white", fontSize: 12, fontWeight: 900, marginBottom: 4,
              }}>
                {i + 1}단계
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#111827", marginBottom: 2 }}>{s.label}</div>
              <div style={{ fontSize: 15, color: "#6b7280", lineHeight: 1.6 }}>{s.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionContent({ content }: { content: ContentBlock[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {content.map((block, i) => {
        if (block.type === "text") {
          return (
            <p key={i} style={{ margin: 0, fontSize: 18, color: "#374151", lineHeight: 1.8, fontWeight: 500 }}>
              {block.body}
            </p>
          );
        }

        if (block.type === "tip") {
          return (
            <div key={i} style={{
              display: "flex", alignItems: "flex-start", gap: 12,
              padding: "16px 18px", borderRadius: 14,
              background: "#fffbeb", border: "2px solid #fcd34d",
            }}>
              <span style={{ fontSize: 22, lineHeight: 1.4, flexShrink: 0 }}>💡</span>
              <span style={{ fontSize: 17, color: "#78350f", fontWeight: 700, lineHeight: 1.7 }}>{block.body}</span>
            </div>
          );
        }

        if (block.type === "steps" && block.items) {
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {block.items.map((item, j) => (
                <div key={j} style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "16px 18px", borderRadius: 14,
                  background: "#f9fafb", border: "1px solid #e5e7eb",
                }}>
                  <div style={{
                    flexShrink: 0, width: 48, height: 48,
                    borderRadius: 14, background: "#111827",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 22,
                  }}>
                    {item.icon}
                  </div>
                  <div>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 8, marginBottom: 4,
                    }}>
                      <span style={{
                        display: "inline-block", width: 24, height: 24,
                        borderRadius: 999, background: "#c9a84c",
                        color: "white", fontSize: 13, fontWeight: 900,
                        textAlign: "center", lineHeight: "24px", flexShrink: 0,
                      }}>{j + 1}</span>
                      <span style={{ fontSize: 18, fontWeight: 800, color: "#111827" }}>{item.label}</span>
                    </div>
                    <div style={{ fontSize: 16, color: "#6b7280", lineHeight: 1.6 }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          );
        }

        if (block.type === "cards" && block.items) {
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {block.items.map((item, j) => (
                <div key={j} style={{
                  padding: "20px 20px", borderRadius: 16,
                  background: "#f9fafb", border: "1px solid #e5e7eb",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <span style={{ fontSize: 26 }}>{item.icon}</span>
                    <span style={{ fontSize: 20, fontWeight: 800, color: "#111827" }}>{item.label}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 17, color: "#4b5563", lineHeight: 1.8 }}>{item.desc}</p>
                </div>
              ))}
            </div>
          );
        }

        if (block.type === "revision" && block.items) {
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {block.items.map((item, j) => (
                <div key={j} style={{
                  borderRadius: 18,
                  border: "2px solid #e5e7eb",
                  overflow: "hidden",
                }}>
                  {/* 헤더 */}
                  <div style={{
                    padding: "18px 20px",
                    background: "#111827",
                    display: "flex", alignItems: "center", gap: 12,
                  }}>
                    <span style={{ fontSize: 26 }}>{item.icon}</span>
                    <span style={{ fontSize: 20, fontWeight: 900, color: "white" }}>{item.label}</span>
                    <span style={{
                      marginLeft: "auto",
                      padding: "4px 14px", borderRadius: 999,
                      background: item.tagBg, color: item.tagColor,
                      fontSize: 14, fontWeight: 900,
                    }}>{item.tag}</span>
                  </div>
                  {/* 내용 */}
                  <div style={{ padding: "18px 20px", background: "white" }}>
                    <p style={{ margin: "0 0 16px", fontSize: 17, color: "#374151", lineHeight: 1.8 }}>{item.desc}</p>

                    {item.ok && (
                      <>
                        <div style={{
                          padding: "14px 16px", borderRadius: 12,
                          background: "#f0fdf4", border: "1px solid #86efac",
                          marginBottom: 12,
                        }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: "#16a34a", marginBottom: 8 }}>
                            ✅ {item.okTitle}
                          </div>
                          <ul style={{ margin: 0, padding: "0 0 0 18px", listStyle: "disc" }}>
                            {item.ok.map((t: string, k: number) => (
                              <li key={k} style={{ fontSize: 16, color: "#166534", lineHeight: 1.8, fontWeight: 600 }}>{t}</li>
                            ))}
                          </ul>
                        </div>
                        <div style={{
                          padding: "14px 16px", borderRadius: 12,
                          background: "#fff1f2", border: "1px solid #fca5a5",
                        }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: "#dc2626", marginBottom: 8 }}>
                            ❌ {item.noTitle}
                          </div>
                          <ul style={{ margin: 0, padding: "0 0 0 18px", listStyle: "disc" }}>
                            {item.no!.map((t: string, k: number) => (
                              <li key={k} style={{ fontSize: 16, color: "#991b1b", lineHeight: 1.8, fontWeight: 600 }}>{t}</li>
                            ))}
                          </ul>
                        </div>
                      </>
                    )}

                    {item.flow && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
                        {item.flow.map((step: string, k: number) => (
                          <div key={k} style={{
                            display: "flex", alignItems: "center", gap: 12,
                            padding: "12px 16px", borderRadius: 12,
                            background: "#fdf8ec", border: "1px solid #c9a84c44",
                          }}>
                            <span style={{
                              flexShrink: 0, width: 26, height: 26,
                              borderRadius: 999, background: "#c9a84c",
                              color: "white", fontSize: 14, fontWeight: 900,
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}>{k + 1}</span>
                            <span style={{ fontSize: 16, color: "#78350f", fontWeight: 600 }}>{step}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          );
        }

        if (block.type === "install") {
          return <InstallContent key={i} />;
        }

        return null;
      })}
    </div>
  );
}

export default function HelpPage() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const toggle = (idx: number) => setOpenIdx(openIdx === idx ? null : idx);

  return (
    <main style={{
      maxWidth: 680,
      margin: "0 auto",
      padding: "32px 16px 96px",
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      background: "#f8fafc",
      minHeight: "100vh",
    }}>

      {/* 페이지 헤더 */}
      <div style={{
        background: "#111827",
        borderRadius: 24,
        padding: "32px 28px",
        marginBottom: 24,
      }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "6px 16px", borderRadius: 999,
          background: "#c9a84c22", border: "1px solid #c9a84c44",
          marginBottom: 14,
        }}>
          <span style={{ fontSize: 16 }}>❓</span>
          <span style={{ fontSize: 14, fontWeight: 800, color: "#c9a84c", letterSpacing: "0.06em" }}>자주 묻는 질문</span>
        </div>
        <h1 style={{ margin: 0, fontSize: 34, fontWeight: 900, color: "white", lineHeight: 1.2 }}>
          도움말
        </h1>
        <p style={{ margin: "10px 0 0", fontSize: 17, color: "rgba(255,255,255,0.65)", lineHeight: 1.7 }}>
          궁금하신 항목을 클릭하면 자세한 안내를 볼 수 있습니다.
        </p>
      </div>

      {/* 아코디언 섹션 목록 */}
      <div style={{
        background: "white",
        borderRadius: 24,
        border: "1px solid #e5e7eb",
        overflow: "hidden",
      }}>
        {SECTIONS.map((sec, idx) => {
          const isOpen = openIdx === idx;
          const isLast = idx === SECTIONS.length - 1;

          return (
            <div key={idx}>
              {/* 아코디언 헤더 */}
              <button
                type="button"
                onClick={() => toggle(idx)}
                style={{
                  width: "100%",
                  padding: "22px 24px",
                  background: isOpen ? "#fdf8ec" : "white",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  textAlign: "left",
                  transition: "background 0.15s",
                }}
              >
                {/* 아이콘 */}
                <div style={{
                  flexShrink: 0, width: 52, height: 52,
                  borderRadius: 16,
                  background: isOpen ? "#c9a84c" : "#111827",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 24,
                  transition: "background 0.15s",
                  boxShadow: isOpen ? "0 4px 12px rgba(201,168,76,0.35)" : "none",
                }}>
                  {sec.icon}
                </div>

                {/* 텍스트 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: "#111827", lineHeight: 1.3 }}>
                    {sec.title}
                  </div>
                  <div style={{ fontSize: 15, color: "#6b7280", marginTop: 3, lineHeight: 1.5 }}>
                    {sec.summary}
                  </div>
                </div>

                {/* 화살표 */}
                <div style={{
                  flexShrink: 0,
                  width: 32, height: 32,
                  borderRadius: 999,
                  background: isOpen ? "#c9a84c" : "#f3f4f6",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.2s",
                }}>
                  <span style={{
                    fontSize: 14,
                    color: isOpen ? "white" : "#6b7280",
                    display: "block",
                    transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s",
                    lineHeight: 1,
                  }}>▼</span>
                </div>
              </button>

              {/* 아코디언 내용 */}
              {isOpen && (
                <div style={{
                  padding: "0 24px 28px",
                  borderTop: "1px solid #fcd34d44",
                  background: "#fdf8ec",
                }}>
                  <div style={{ paddingTop: 20 }}>
                    <SectionContent content={sec.content} />
                  </div>
                </div>
              )}

              {/* 구분선 (마지막 제외) */}
              {!isLast && (
                <div style={{
                  height: 1,
                  background: "#f3f4f6",
                  margin: "0 24px",
                }} />
              )}
            </div>
          );
        })}
      </div>

      {/* 고객센터 CTA */}
      <div style={{
        marginTop: 24,
        padding: "32px 28px",
        borderRadius: 24,
        background: "#111827",
        textAlign: "center",
      }}>
        <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "white", lineHeight: 1.5 }}>
          원하는 답변을 찾지 못하셨나요?
        </p>
        <p style={{ margin: "8px 0 0", fontSize: 16, color: "rgba(255,255,255,0.65)" }}>
          운영팀이 직접 답변해 드립니다.
        </p>
        <Link
          href="/customer-service"
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            marginTop: 20,
            minHeight: 58, padding: "0 36px",
            borderRadius: 18,
            background: "#c9a84c",
            color: "white",
            fontWeight: 900,
            fontSize: 18,
            textDecoration: "none",
            boxShadow: "0 4px 16px rgba(201,168,76,0.45)",
          }}
        >
          고객센터 1:1 문의하기
        </Link>
      </div>

    </main>
  );
}
