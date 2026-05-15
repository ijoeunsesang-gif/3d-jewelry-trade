"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabase-browser";
import GradeBadge from "../../../components/GradeBadge";
import { Grade, MentorGrade, MENTOR_GRADE_CONFIG, mentorGradeOrder } from "@/lib/grades";
import { getAccessToken, decodeJwt } from "@/lib/supabase-fetch";
import { showError, showInfo } from "../../../lib/toast";

const CURRENT_YEAR = new Date().getFullYear();

type SkillItem = { name: string; level: string };

const LEVEL_COLOR: Record<string, { bg: string; color: string }> = {
  상: { bg: "#fdf6e3", color: "#92681a" },
  중: { bg: "#f3f4f6", color: "#374151" },
  하: { bg: "#f9fafb", color: "#9ca3af" },
};

const SESSION_TYPES = {
  image_review:  { label: "이미지 검토",      price: 3000,  desc: "이미지로 CAD 작업 피드백",   icon: "🖼",  accept: "image/*" },
  file_review:   { label: "파일 검토",        price: 5000,  desc: "CAD 파일 열람 후 피드백",    icon: "📂",  accept: ".3dm,.stl,.obj" },
  file_edit:     { label: "파일 수정",        price: 10000, desc: "직접 파일 수정 후 전달",     icon: "✏️", accept: ".3dm" },
  cad_revision:  { label: "CAD수정 질문",     price: 19900, desc: "CAD 파일 직접 수정 질문",    icon: "🔧",  accept: ".3dm" },
  review:        { label: "실무 검수 질문",   price: 29900, desc: "제작 가능 여부 전문 검수",   icon: "🔍",  accept: ".3dm,.stl,.obj" },
  review_cad:    { label: "검수+CAD수정 질문",price: 49900, desc: "검수 후 직접 CAD 수정까지",  icon: "⚡",  accept: ".3dm" },
} as const;

type SessionTypeKey = keyof typeof SESSION_TYPES;

type FileItem = { name: string; url: string; ext: string };

type Mentor = {
  id: string;
  intro: string;
  user_id: string;
  career_start_year: number | null;
  programs: SkillItem[];
  work_types: SkillItem[];
  can_cpx: boolean;
  mentor_grade: MentorGrade | null;
  completed_count: number | null;
  avg_rating: number | null;
  profiles: { nickname: string | null; avatar_url: string | null; grade: string | null } | null;
};

export default function MentorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mentor, setMentor] = useState<Mentor | null>(null);
  const [loading, setLoading] = useState(true);
  const [myUserId, setMyUserId] = useState<string | null>(null);

  const [selectedType, setSelectedType] = useState<SessionTypeKey | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<FileItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      const payload = decodeJwt(token) as { sub?: string } | null;
      setMyUserId(payload?.sub ?? null);
    }
    loadMentor();
  }, [id]);

  const loadMentor = async () => {
    const { data } = await supabase
      .from("cad_mentors")
      .select("id, intro, user_id, career_start_year, programs, work_types, can_cpx, mentor_grade, completed_count, avg_rating, profiles(nickname, avatar_url, grade)")
      .eq("id", id)
      .eq("is_active", true)
      .single();

    if (!data) { router.push("/cad-school"); return; }
    setMentor(data as unknown as Mentor);
    setLoading(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    const token = getAccessToken();
    if (!token) { showError("로그인이 필요합니다."); return; }
    if (files.length + selected.length > 5) { showError("파일은 최대 5개까지 첨부할 수 있습니다."); return; }
    setUploading(true);
    for (const file of selected) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const path = `cad-school/sessions/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const fd = new FormData();
      fd.append("file", file); fd.append("bucket", "thumbnails"); fd.append("path", path);
      const res = await fetch("/api/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      const data = await res.json();
      if (data.url) setFiles((prev) => [...prev, { name: file.name, url: data.url, ext }]);
      else showError(`업로드 실패: ${data.error || file.name}`);
    }
    setUploading(false);
    e.target.value = "";
  };

  const handleSelectType = (type: SessionTypeKey) => {
    setSelectedType(type);
    setShowForm(true);
    setTitle("");
    setDescription("");
    setFiles([]);
  };

  const handleCancel = () => {
    setSelectedType(null);
    setShowForm(false);
    setTitle("");
    setDescription("");
    setFiles([]);
  };

  const requestPayment = async () => {
    const token = getAccessToken();
    if (!token) { showInfo("로그인이 필요합니다."); router.push("/auth"); return; }
    if (!mentor || !selectedType) return;
    if (myUserId === mentor.user_id) { showError("본인의 멘토링은 질문할 수 없습니다."); return; }
    if (!title.trim()) { showError("멘토링 제목을 입력해주세요."); return; }
    if (!description.trim()) { showError("멘토링 내용을 입력해주세요."); return; }

    const sessionType = SESSION_TYPES[selectedType];
    const price = sessionType.price;
    const payload = decodeJwt(token) as { sub?: string } | null;
    const orderId = `cad-session-${Date.now()}`;

    localStorage.setItem("pendingCadPayment", JSON.stringify({
      type: "session",
      sessionType: selectedType,
      mentorId: mentor.id,
      menteeId: payload?.sub,
      price,
      title: title.trim(),
      description: description.trim(),
      files,
      orderId,
      orderName: `[캐드스쿨] ${sessionType.label}`,
    }));

    setPaying(true);
    router.push("/cad-school/payment");
  };

  if (loading) return <main style={{ padding: "60px 20px", textAlign: "center", color: "#6b7280" }}>불러오는 중...</main>;
  if (!mentor) return null;

  const isMyMentor = myUserId === mentor.user_id;
  const currentType = selectedType ? SESSION_TYPES[selectedType] : null;
  const careerYears = mentor.career_start_year ? CURRENT_YEAR - mentor.career_start_year : null;
  const programs = (mentor.programs ?? []) as SkillItem[];
  const workTypes = (mentor.work_types ?? []) as SkillItem[];

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "32px 20px 96px", fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <Link href="/cad-school" style={{ color: "#6b7280", textDecoration: "none", fontSize: 14 }}>← 캐드스쿨</Link>
        <span style={{ color: "#d1d5db" }}>/</span>
        <span style={{ fontSize: 14, color: "#111827", fontWeight: 700 }}>멘토 프로필</span>
      </div>

      {/* 멘토 프로필 */}
      <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 20, padding: "28px 28px", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          <Avatar url={mentor.profiles?.avatar_url} size={72} />
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 22, fontWeight: 900, color: "#111827" }}>{mentor.profiles?.nickname ?? "멘토"}</span>
              {mentor.profiles?.grade && <GradeBadge grade={mentor.profiles.grade as Grade} size="md" />}
            </div>
            <p style={{ margin: "0 0 12px", fontSize: 14, color: "#374151", lineHeight: 1.7 }}>
              {mentor.intro || "소개글이 없습니다."}
            </p>

            {/* 경력 */}
            {careerYears !== null && (
              <div style={{ marginBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#374151", background: "#f3f4f6", borderRadius: 8, padding: "4px 10px" }}>
                  경력 {careerYears}년
                </span>
              </div>
            )}

            {/* 사용 프로그램 */}
            {programs.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", marginBottom: 6, letterSpacing: 0.5 }}>사용 프로그램</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {programs.map((p) => {
                    const lc = LEVEL_COLOR[p.level] ?? LEVEL_COLOR["중"];
                    return (
                      <span key={p.name} style={{ fontSize: 12, fontWeight: 700, background: lc.bg, color: lc.color, border: `1px solid ${lc.color}33`, borderRadius: 8, padding: "3px 10px" }}>
                        {p.name} · {p.level}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 작업 분야 */}
            {workTypes.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", marginBottom: 6, letterSpacing: 0.5 }}>작업 분야</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {workTypes.map((w) => {
                    const lc = LEVEL_COLOR[w.level] ?? LEVEL_COLOR["중"];
                    return (
                      <span key={w.name} style={{ fontSize: 12, fontWeight: 700, background: lc.bg, color: lc.color, border: `1px solid ${lc.color}33`, borderRadius: 8, padding: "3px 10px" }}>
                        {w.name} · {w.level}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* CPX */}
            {mentor.can_cpx && (
              <div style={{ fontSize: 12, fontWeight: 700, color: "#16a34a" }}>✅ CPX 금주물 모델링 가능</div>
            )}

            {/* 멘토 등급 */}
            {(() => {
              const mg = (mentor.mentor_grade ?? "normal") as MentorGrade;
              const mgCfg = MENTOR_GRADE_CONFIG[mg];
              const completed = mentor.completed_count ?? 0;
              const orderIdx = mentorGradeOrder(mg);
              const nextGrades: MentorGrade[] = ["normal", "certified", "pro", "master"];
              const nextMg = orderIdx < 3 ? nextGrades[orderIdx + 1] : null;
              const nextMgCfg = nextMg ? MENTOR_GRADE_CONFIG[nextMg] : null;
              const remaining = nextMgCfg ? Math.max(0, nextMgCfg.minCompleted - completed) : 0;
              return (
                <div style={{ marginTop: 8, padding: "10px 14px", background: mgCfg.bg, border: `1px solid ${mgCfg.border}`, borderRadius: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: mgCfg.color }}>{mgCfg.label}</span>
                    <span style={{ fontSize: 12, color: "#6b7280" }}>수수료 {Math.round(mgCfg.commission * 100)}%</span>
                    <span style={{ fontSize: 12, color: "#9ca3af" }}>· 완료 {completed}건</span>
                  </div>
                  {nextMgCfg && (
                    <div style={{ fontSize: 11, color: "#6b7280" }}>
                      {remaining > 0
                        ? `${nextMgCfg.label}까지 ${remaining}건 남음`
                        : `${nextMgCfg.label} 승급 조건 충족 중`}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
          {isMyMentor && (
            <Link
              href="/cad-school/mentor/register"
              style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 14px", textDecoration: "none" }}
            >
              정보 수정
            </Link>
          )}
        </div>
      </div>

      {!isMyMentor && (
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <a
            href="#paid-feedback-section"
            onClick={(e) => { e.preventDefault(); document.getElementById("paid-feedback-section")?.scrollIntoView({ behavior: "smooth" }); }}
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "13px", borderRadius: 14, background: "#111827", color: "white", fontWeight: 800, fontSize: 14, textDecoration: "none", cursor: "pointer" }}
          >
            💬 유료 질문하기
          </a>
          <Link
            href="/cad-school?tab=subscription"
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "13px", borderRadius: 14, background: "#c9a84c", color: "white", fontWeight: 800, fontSize: 14, textDecoration: "none" }}
          >
            📦 수강 패키지 보기
          </Link>
        </div>
      )}

      {!isMyMentor && (
        <div id="paid-feedback-section" style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 20, padding: "24px 28px" }}>
          <div style={{ fontSize: 17, fontWeight: 900, color: "#111827", marginBottom: 4 }}>유료 피드백 질문</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>질문 유형을 선택해주세요</div>

          {!showForm ? (
            /* 유형 선택 카드 */
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
              {(Object.entries(SESSION_TYPES) as [SessionTypeKey, typeof SESSION_TYPES[SessionTypeKey]][]).map(([key, info]) => (
                <button
                  key={key}
                  onClick={() => handleSelectType(key)}
                  style={{
                    background: "#f8fafc", border: "1.5px solid #e5e7eb", borderRadius: 16, padding: "20px 12px",
                    cursor: "pointer", textAlign: "center", transition: "border-color 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#111827")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e5e7eb")}
                >
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{info.icon}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#111827", marginBottom: 4 }}>{info.label}</div>
                  <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 10, lineHeight: 1.5 }}>{info.desc}</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: "#2563eb" }}>{info.price.toLocaleString("ko-KR")}원</div>
                </button>
              ))}
            </div>
          ) : (
            /* 의뢰 폼 */
            <div>
              {/* 선택된 유형 표시 */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 12, padding: "12px 16px", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 20 }}>{currentType?.icon}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#0c4a6e" }}>{currentType?.label}</div>
                    <div style={{ fontSize: 12, color: "#0369a1" }}>{currentType?.price.toLocaleString("ko-KR")}원</div>
                  </div>
                </div>
                <button
                  onClick={handleCancel}
                  style={{ fontSize: 12, color: "#6b7280", background: "none", border: "1px solid #d1d5db", borderRadius: 8, padding: "5px 12px", cursor: "pointer" }}
                >
                  유형 변경
                </button>
              </div>

              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="멘토링 제목 (예: 링 CAD 디테일 피드백 요청)"
                style={{ ...inputStyle, marginBottom: 10 }}
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="어떤 피드백이 필요한지 자세히 설명해주세요."
                rows={4}
                style={{ ...inputStyle, resize: "vertical", marginBottom: 10 }}
              />

              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
                {files.map((f, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, background: "#f3f4f6", borderRadius: 8, padding: "3px 8px", fontSize: 12 }}>
                    <span>{["jpg","jpeg","png","webp","gif"].includes(f.ext) ? "🖼" : "📎"}</span>
                    <span style={{ maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                    <button onClick={() => setFiles((p) => p.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}>×</button>
                  </div>
                ))}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{ fontSize: 12, color: "#6b7280", background: "#f3f4f6", border: "none", borderRadius: 8, padding: "5px 10px", cursor: "pointer" }}
                >
                  {uploading ? "업로드 중..." : "📎 파일 첨부"}
                </button>
                <input ref={fileInputRef} type="file" multiple accept={selectedType ? SESSION_TYPES[selectedType].accept : ".jpg,.jpeg,.png,.webp,.gif,.stl,.obj,.3dm"} style={{ display: "none" }} onChange={handleFileChange} />
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={handleCancel} style={{ padding: "12px 20px", borderRadius: 12, border: "1px solid #d1d5db", background: "white", color: "#374151", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                  취소
                </button>
                <button
                  onClick={requestPayment}
                  disabled={paying || uploading}
                  style={{ flex: 1, padding: "12px", borderRadius: 12, border: "none", background: paying ? "#d1d5db" : "#111827", color: "white", fontWeight: 800, fontSize: 14, cursor: paying || uploading ? "not-allowed" : "pointer" }}
                >
                  {paying ? "결제 중..." : `질문하기 · ${currentType?.price.toLocaleString("ko-KR")}원`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

function Avatar({ url, size }: { url?: string | null; size: number }) {
  return url ? (
    <img src={url} alt="avatar" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "1px solid #e5e7eb" }} />
  ) : (
    <div style={{ width: size, height: size, borderRadius: "50%", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.5, flexShrink: 0, color: "#9ca3af" }}>👤</div>
  );
}

const inputStyle: React.CSSProperties = { width: "100%", padding: "11px 14px", borderRadius: 10, border: "1px solid #d1d5db", fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
