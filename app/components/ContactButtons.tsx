"use client";

import { useEffect, useState } from "react";

export default function ContactButtons({
  opentalkUrl,
  contactPhone,
}: {
  opentalkUrl?: string | null;
  contactPhone?: string | null;
}) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const hasOpentalk = !!opentalkUrl;
  const hasPhone = !!contactPhone;

  if (!hasOpentalk && !hasPhone) return null;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
      {hasOpentalk && (
        <a
          href={opentalkUrl!}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            height: 44,
            padding: "0 18px",
            borderRadius: 12,
            border: "none",
            background: "#FEE500",
            color: "#3C1E1E",
            fontWeight: 700,
            fontSize: 14,
            textDecoration: "none",
          }}
        >
          💬 카톡으로 상담하기
        </a>
      )}
      {hasPhone && (
        isMobile ? (
          <a
            href={`sms:${contactPhone}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              height: 44,
              padding: "0 18px",
              borderRadius: 12,
              border: "1px solid #d1d5db",
              background: "white",
              color: "#374151",
              fontWeight: 700,
              fontSize: 14,
              textDecoration: "none",
            }}
          >
            📱 문자로 상담하기
          </a>
        ) : (
          <span style={{ fontSize: 14, color: "#374151", fontWeight: 600 }}>
            문자 문의: {contactPhone}
          </span>
        )
      )}
    </div>
  );
}
