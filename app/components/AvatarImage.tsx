"use client";

import { useState } from "react";

interface AvatarImageProps {
  avatarUrl?: string | null;
  nickname?: string | null;
  size?: number;
  border?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  className?: string;
}

export default function AvatarImage({
  avatarUrl,
  nickname,
  size = 40,
  border = "1px solid #e5e7eb",
  style,
  onClick,
  className,
}: AvatarImageProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const initial = (nickname?.trim().charAt(0) || "?").toUpperCase();
  const showInitial = !avatarUrl || imgFailed;

  const shared: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    flexShrink: 0,
    border,
    ...(onClick ? { cursor: "pointer" } : {}),
    ...style,
  };

  if (showInitial) {
    return (
      <div
        onClick={onClick}
        className={className}
        style={{
          ...shared,
          background: "linear-gradient(135deg, #b8960c, #d4af37)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontWeight: 800,
          fontSize: Math.round(size * 0.4),
          userSelect: "none",
        }}
      >
        {initial}
      </div>
    );
  }

  return (
    <img
      src={avatarUrl!}
      alt={nickname || ""}
      className={className}
      onClick={onClick}
      onError={() => setImgFailed(true)}
      style={{ ...shared, objectFit: "cover", display: "block" }}
    />
  );
}
