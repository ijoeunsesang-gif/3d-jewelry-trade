"use client";

export type StepStatus = "pending" | "loading" | "done";

export interface ProgressStep {
  label: string;
  status: StepStatus;
}

interface Props {
  isVisible: boolean;
  steps: ProgressStep[];
}

export default function UploadProgress({ isVisible, steps }: Props) {
  if (!isVisible) return null;

  const currentStep = (() => {
    const idx = steps.findIndex((s) => s.status === "loading");
    return idx === -1 ? steps.length : idx;
  })();

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999,
    }}>
      <style>{`
        @keyframes up-spin { to { transform: rotate(360deg); } }
        .up-spin { display: inline-block; animation: up-spin 1s linear infinite; }
      `}</style>
      <div style={{
        background: "white", borderRadius: 16, padding: "32px 40px",
        minWidth: 300, textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      }}>
        <div style={{ fontSize: 28, marginBottom: 16 }}>
          <span className="up-spin">⟳</span>
        </div>
        <div style={{ fontWeight: 700, marginBottom: 20, color: "#1a1a1a", fontSize: 15 }}>
          처리 중입니다...
        </div>
        <div style={{ textAlign: "left" }}>
          {steps.map((step, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 10,
              marginBottom: 10, opacity: i > currentStep ? 0.3 : 1,
            }}>
              <span style={{ fontSize: 18, width: 24, flexShrink: 0, textAlign: "center" }}>
                {step.status === "done"
                  ? "✅"
                  : step.status === "loading"
                    ? <span className="up-spin">⟳</span>
                    : "○"}
              </span>
              <span style={{ color: step.status === "loading" ? "#b8960c" : "#333", fontSize: 14 }}>
                {step.label}
              </span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16, fontSize: 12, color: "#888" }}>
          잠시만 기다려주세요
        </div>
      </div>
    </div>
  );
}

export function buildSteps(labels: string[], currentStep: number): ProgressStep[] {
  return labels.map((label, i) => ({
    label,
    status: i < currentStep ? "done" : i === currentStep ? "loading" : "pending",
  }));
}
