export type ProgressStatus = "uploading" | "downloading" | "done" | "error";

export type ProgressItem = {
  id: string;
  label: string;
  percent: number;
  status: ProgressStatus;
  message?: string;
};

const EVENT = "progress-store-update";

function dispatch(detail: Partial<ProgressItem> & { id: string }) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail }));
}

export function startProgress(id: string, label: string, type: "uploading" | "downloading") {
  dispatch({ id, label, percent: 0, status: type });
}

export function updateProgress(id: string, percent: number) {
  dispatch({ id, percent });
}

export function completeProgress(id: string) {
  dispatch({ id, percent: 100, status: "done" });
}

export function errorProgress(id: string, message?: string) {
  dispatch({ id, status: "error", message });
}

export { EVENT as PROGRESS_EVENT };
