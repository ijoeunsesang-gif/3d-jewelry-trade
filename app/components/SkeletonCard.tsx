"use client";

export function SkeletonCard() {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 22,
        overflow: "hidden",
        background: "white",
        boxShadow: "0 6px 20px rgba(15, 23, 42, 0.04)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          background: "#e5e7eb",
          aspectRatio: "16 / 10",
          animation: "skeleton-pulse 1.5s ease-in-out infinite",
        }}
      />
      <div style={{ padding: 15, display: "flex", flexDirection: "column", gap: 10 }}>
        <div
          style={{
            height: 24,
            borderRadius: 8,
            background: "#e5e7eb",
            width: "70%",
            animation: "skeleton-pulse 1.5s ease-in-out infinite",
          }}
        />
        <div
          style={{
            height: 16,
            borderRadius: 8,
            background: "#e5e7eb",
            width: "90%",
            animation: "skeleton-pulse 1.5s ease-in-out infinite",
          }}
        />
        <div
          style={{
            height: 16,
            borderRadius: 8,
            background: "#e5e7eb",
            width: "50%",
            marginTop: 4,
            animation: "skeleton-pulse 1.5s ease-in-out infinite",
          }}
        />
      </div>
    </div>
  );
}

export function SkeletonTopCard() {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        overflow: "hidden",
        background: "white",
        boxShadow: "0 4px 14px rgba(15,23,42,0.06)",
      }}
    >
      <div
        style={{
          background: "#e5e7eb",
          height: 120,
          animation: "skeleton-pulse 1.5s ease-in-out infinite",
        }}
      />
      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        <div
          style={{
            height: 16,
            borderRadius: 6,
            background: "#e5e7eb",
            width: "75%",
            animation: "skeleton-pulse 1.5s ease-in-out infinite",
          }}
        />
        <div
          style={{
            height: 14,
            borderRadius: 6,
            background: "#e5e7eb",
            width: "50%",
            animation: "skeleton-pulse 1.5s ease-in-out infinite",
          }}
        />
      </div>
    </div>
  );
}
