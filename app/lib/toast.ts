import toast from "react-hot-toast";

const baseStyle = {
  borderRadius: "12px",
  fontWeight: 700,
  padding: "12px 16px",
};

export const showSuccess = (message: string) =>
  toast.success(message, {
    style: {
      ...baseStyle,
      background: "#000000ff",
      color: "#02ff2cff",
    },
  });

export const showError = (message: string) =>
  toast.error(message, {
    style: {
      ...baseStyle,
      background: "#000000ff",
      color: "#ff0000ff",
    },
  });

export const showInfo = (message: string) =>
  toast(message, {
    style: {
      ...baseStyle,
      background: "#111827",
      color: "#ffffff",
    },
  });