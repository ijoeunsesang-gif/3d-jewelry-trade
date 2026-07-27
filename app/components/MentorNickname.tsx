"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase-browser";
import { GOLD } from "@/lib/constants";
import { getProfile } from "../lib/getProfile";

const CURRENT_YEAR = new Date().getFullYear();

export type MentorMiniData = {
  id: string;
  user_id: string;
  intro: string;
  career_start_year: number | null;
  avg_rating: number;
  total_ratings: number;
  response_rate: number;
  programs: { name: string; level: string }[];
  work_types: { name: string; level: string }[];
  profiles: { nickname: string | null; avatar_url: string | null; grade: string | null } | null;
};

type Props = {
  mentorId: string;
  nickname: string;
  isMentor: boolean;
  inModal?: boolean;
  onSelectMentor?: (mentor: MentorMiniData) => void;
};

export default function MentorNickname({ mentorId, nickname, isMentor, inModal = false, onSelectMentor }: Props) {
  const router = useRouter();
  const [showPopover, setShowPopover] = useState(false);
  const [mentorData, setMentorData] = useState<MentorMiniData | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isMentor) {
    return <span>{nickname}</span>;
  }

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (!inModal) {
      router.push(`/cad-school/mentor/${mentorId}`);
      return;
    }

    if (!mentorData) {
      setLoading(true);
      const { data } = await supabase
        .from("cad_mentors")
        .select("id, user_id, intro, career_start_year, avg_rating, total_ratings, response_rate, programs, work_types")
        .eq("id", mentorId)
        .single();
      // 멘토 닉네임/아바타/등급은 FK 임베딩 대신 profiles_public 조회로 가져온다.
      const profile = data ? await getProfile(data.user_id) : null;
      setMentorData(data ? ({ ...data, profiles: profile } as unknown as MentorMiniData) : null);
      setLoading(false);
    }
    setShowPopover(true);
  };

  const btnStyle: React.CSSProperties = {
    background: "none",
    border: "none",
    padding: 0,
    cursor: "pointer",
    font: "inherit",
    color: inModal ? "#1d4ed8" : "inherit",
    textDecoration: "underline",
    textDecorationStyle: "dotted",
    textUnderlineOffset: 2,
    lineHeight: "inherit",
  };

  return (
    <>
      <button onClick={handleClick} style={btnStyle}>
        {nickname}
      </button>

      {showPopover && (
        <div
          onClick={() => setShowPopover(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            background: "rgba(0,0,0,0.3)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white",
              borderRadius: 20,
              padding: "24px 24px 20px",
              maxWidth: 360,
              width: "100%",
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
              position: "relative",
            }}
          >
            <button
              onClick={() => setShowPopover(false)}
              style={{
                position: "absolute",
                top: 12,
                right: 14,
                background: "none",
                border: "none",
                fontSize: 22,
                cursor: "pointer",
                color: "#9ca3af",
                lineHeight: 1,
                padding: "0 4px",
              }}
            >
              ×
            </button>

            {loading && !mentorData ? (
              <div style={{ padding: "24px 0", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
                불러오는 중...
              </div>
            ) : mentorData ? (
              <MentorMiniProfile
                mentor={mentorData}
                onSelect={
                  onSelectMentor
                    ? () => { onSelectMentor(mentorData); setShowPopover(false); }
                    : undefined
                }
                onClose={() => setShowPopover(false)}
              />
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}

function MentorMiniProfile({
  mentor,
  onSelect,
  onClose,
}: {
  mentor: MentorMiniData;
  onSelect?: () => void;
  onClose: () => void;
}) {
  const careerYrs = mentor.career_start_year ? CURRENT_YEAR - mentor.career_start_year : null;
  const programs = (mentor.programs ?? []) as { name: string; level: string }[];
  const workTypes = (mentor.work_types ?? []) as { name: string; level: string }[];
  const allTags = [
    ...programs.map((p) => ({ label: p.name, gold: false })),
    ...workTypes.map((w) => ({ label: w.name, gold: true })),
  ];

  return (
    <div>
      {/* 프로필 헤더 */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14 }}>
        <MiniAvatar url={mentor.profiles?.avatar_url} size={52} />
        <div>
          <div style={{ fontSize: 17, fontWeight: 900, color: "#111827", marginBottom: 2 }}>
            {mentor.profiles?.nickname ?? "멘토"}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {mentor.avg_rating > 0 && (
              <span style={{ fontSize: 12, color: GOLD, fontWeight: 700 }}>★ {mentor.avg_rating.toFixed(1)}</span>
            )}
            {careerYrs !== null && (
              <span style={{ fontSize: 12, color: "#6b7280" }}>경력 {careerYrs}년</span>
            )}
          </div>
        </div>
      </div>

      {/* 전문분야 태그 */}
      {allTags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 12 }}>
          {allTags.map((t, i) => (
            <span
              key={i}
              style={{
                fontSize: 11,
                fontWeight: 700,
                background: t.gold ? "#fdf6e3" : "#f3f4f6",
                color: t.gold ? "#92681a" : "#374151",
                borderRadius: 6,
                padding: "2px 8px",
              }}
            >
              {t.label}
            </span>
          ))}
        </div>
      )}

      {/* 소개 */}
      {mentor.intro && (
        <p style={{ margin: "0 0 14px", fontSize: 13, color: "#374151", lineHeight: 1.6, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {mentor.intro}
        </p>
      )}

      {/* 액션 버튼 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
        {onSelect && (
          <button
            onClick={onSelect}
            style={{
              width: "100%",
              padding: "11px",
              borderRadius: 12,
              border: "none",
              background: "#111827",
              color: "white",
              fontWeight: 800,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            이 멘토 선택하기
          </button>
        )}
        <a
          href={`/cad-school/mentor/${mentor.id}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onClose}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "9px",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            color: "#374151",
            fontWeight: 700,
            fontSize: 13,
            textDecoration: "none",
          }}
        >
          프로필 전체 보기 →
        </a>
      </div>
    </div>
  );
}

function MiniAvatar({ url, size }: { url?: string | null; size: number }) {
  return url ? (
    <img
      src={url}
      alt="avatar"
      style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "1px solid #e5e7eb" }}
    />
  ) : (
    <div
      style={{ width: size, height: size, borderRadius: "50%", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.45, flexShrink: 0, color: "#9ca3af" }}
    >
      👤
    </div>
  );
}
