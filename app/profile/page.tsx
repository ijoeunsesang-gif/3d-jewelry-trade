"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase-browser";
import { showError, showInfo, showSuccess } from "../lib/toast";

export default function ProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        showInfo("로그인이 필요합니다.");
        router.push("/auth");
        return;
      }

      const user = session.user;
      setUserId(user.id);
      setEmail(user.email || "");

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.error("프로필 불러오기 실패:", error);
      }

      if (profile) {
        setNickname(profile.nickname || "");
        setBio(profile.bio || "");
        setAvatarUrl(profile.avatar_url || "");
        setPreviewUrl(profile.avatar_url || "");
      } else {
        const defaultNickname = user.email?.split("@")[0] || "user";

        const { error: insertError } = await supabase.from("profiles").insert({
          id: user.id,
          email: user.email || "",
          nickname: defaultNickname,
          bio: "",
          avatar_url: "",
        });

        if (insertError) {
          console.error("프로필 생성 실패:", insertError);
        }

        setNickname(defaultNickname);
      }
    } catch (error) {
      console.error("프로필 페이지 오류:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!userId) {
        showError("로그인 정보를 먼저 불러와야 합니다.");
        return;
      }

      setUploading(true);

      const localPreview = URL.createObjectURL(file);
      setPreviewUrl(localPreview);

      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const filePath = `avatars/${userId}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("thumbnails")
        .upload(filePath, file, {
          upsert: true,
        });

      if (uploadError) {
        console.error("프로필 이미지 업로드 실패:", uploadError);
        showError(`프로필 이미지 업로드 실패: ${uploadError.message}`);
        return;
      }

      const publicUrl = supabase.storage
        .from("thumbnails")
        .getPublicUrl(filePath).data.publicUrl;

      setAvatarUrl(publicUrl);
      setPreviewUrl(publicUrl);
    } catch (error) {
      console.error("프로필 이미지 처리 오류:", error);
      showError("프로필 이미지 처리 중 오류가 발생했습니다.");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (!userId) return;

      setSaving(true);

      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", userId)
        .maybeSingle();

      if (existing) {
        const { error: updateError } = await supabase
          .from("profiles")
          .update({
            nickname,
            bio,
            avatar_url: avatarUrl,
            email,
          })
          .eq("id", userId);

        if (updateError) {
          console.error("프로필 수정 실패:", updateError);
          showError("프로필 저장에 실패했습니다.");
          return;
        }
      } else {
        const { error: insertError } = await supabase.from("profiles").insert({
          id: userId,
          email,
          nickname,
          bio,
          avatar_url: avatarUrl,
        });

        if (insertError) {
          console.error("프로필 생성 실패:", insertError);
          showError("프로필 저장에 실패했습니다.");
          return;
        }
      }

      showSuccess("프로필이 저장되었습니다.");
      window.dispatchEvent(new Event("messages-updated"));
      window.location.reload();
    } catch (error) {
      console.error("프로필 저장 오류:", error);
      showError("프로필 저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main style={pageWrap}>
        <p style={{ color: "#6b7280" }}>프로필 불러오는 중...</p>
      </main>
    );
  }

  return (
    <main style={pageWrap}>
      <div style={headerWrap}>
        <div>
          <h1 style={pageTitle}>프로필 수정</h1>
          <p style={pageDesc}>판매자 닉네임, 소개, 프로필 이미지를 설정할 수 있습니다.</p>
        </div>
      </div>

      <section style={cardWrap} className="profile-card-wrap">
        <div style={avatarSection}>
          <img
            src={previewUrl || "/default-avatar.png"}
            alt="profile"
            style={avatarImg}
          />

          <label style={uploadBtn}>
            {uploading ? "업로드 중..." : "이미지 업로드"}
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              style={{ display: "none" }}
            />
          </label>
        </div>

        <div style={formSection}>
          <div style={fieldWrap}>
            <label style={labelStyle}>이메일</label>
            <input
              value={email}
              readOnly
              style={{ ...inputStyle, background: "#f8fafc", color: "#6b7280" }}
            />
          </div>

          <div style={fieldWrap}>
            <label style={labelStyle}>닉네임</label>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="판매자 닉네임 입력"
              style={inputStyle}
            />
          </div>

          <div style={fieldWrap}>
            <label style={labelStyle}>소개글</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="판매자 소개를 입력하세요"
              style={textareaStyle}
            />
          </div>

          <div style={buttonRow}>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              style={primaryBtn}
            >
              {saving ? "저장 중..." : "저장하기"}
            </button>

            <button
              type="button"
              onClick={() => router.back()}
              style={secondaryBtn}
            >
              뒤로가기
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

const pageWrap: React.CSSProperties = {
  maxWidth: 1100,
  margin: "0 auto",
  padding: "32px 20px 60px",
  fontFamily:
    'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

const headerWrap: React.CSSProperties = {
  marginBottom: 24,
};

const pageTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 40,
  fontWeight: 900,
  color: "#111827",
};

const pageDesc: React.CSSProperties = {
  margin: "10px 0 0",
  color: "#6b7280",
  fontSize: 15,
  lineHeight: 1.7,
};

const cardWrap: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "280px 1fr",
  gap: 24,
  border: "1px solid #e5e7eb",
  borderRadius: 28,
  background: "white",
  padding: 24,
};

const avatarSection: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 16,
};

const avatarImg: React.CSSProperties = {
  width: 160,
  height: 160,
  borderRadius: "50%",
  objectFit: "cover",
  border: "1px solid #e5e7eb",
};

const uploadBtn: React.CSSProperties = {
  height: 44,
  padding: "0 18px",
  borderRadius: 14,
  background: "#111827",
  color: "white",
  display: "inline-flex",
  alignItems: "center",
  cursor: "pointer",
  fontWeight: 800,
};

const formSection: React.CSSProperties = {
  display: "grid",
  gap: 16,
};

const fieldWrap: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const labelStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  color: "#111827",
};

const inputStyle: React.CSSProperties = {
  height: 48,
  borderRadius: 14,
  border: "1px solid #d1d5db",
  padding: "0 14px",
  outline: "none",
  fontSize: 14,
  width: "100%",
  boxSizing: "border-box",
};

const textareaStyle: React.CSSProperties = {
  minHeight: 140,
  borderRadius: 16,
  border: "1px solid #d1d5db",
  padding: 14,
  outline: "none",
  fontSize: 14,
  resize: "vertical",
  width: "100%",
  boxSizing: "border-box",
  fontFamily:
    'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

const buttonRow: React.CSSProperties = {
  display: "flex",
  gap: 12,
  marginTop: 8,
};

const primaryBtn: React.CSSProperties = {
  height: 48,
  padding: "0 18px",
  borderRadius: 14,
  border: "none",
  background: "#111827",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};

const secondaryBtn: React.CSSProperties = {
  height: 48,
  padding: "0 18px",
  borderRadius: 14,
  border: "1px solid #d1d5db",
  background: "white",
  color: "#111827",
  fontWeight: 800,
  cursor: "pointer",
};