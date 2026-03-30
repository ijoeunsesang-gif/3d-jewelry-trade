import toast from "react-hot-toast";

const baseStyle = {
  background: "#ffffff",
  color: "#111827",
  border: "1px solid #e5e7eb",
  borderRadius: "12px",
  fontWeight: 600,
  fontSize: "14px",
  padding: "10px 16px",
  boxShadow: "0 4px 16px rgba(15,23,42,0.08)",
};

export const showSuccess = (message: string, duration = 5000) =>
  toast.success(message, {
    duration,
    style: {
      ...baseStyle,
      borderColor: "#bbf7d0",
    },
    iconTheme: {
      primary: "#16a34a",
      secondary: "#ffffff",
    },
  });

export const showError = (message: string, duration = 5000) =>
  toast.error(message, {
    duration,
    style: {
      ...baseStyle,
      borderColor: "#fecaca",
    },
    iconTheme: {
      primary: "#dc2626",
      secondary: "#ffffff",
    },
  });

export const showInfo = (message: string) =>
  toast(message, {
    style: {
      ...baseStyle,
      borderColor: "#e5e7eb",
    },
    icon: "ℹ️",
  });