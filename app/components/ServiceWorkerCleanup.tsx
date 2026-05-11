"use client";
import { useEffect } from "react";

export default function ServiceWorkerCleanup() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/service-worker.js")
      .then((reg) => {
        console.info("[SW] registered, scope:", reg.scope);
      })
      .catch((err) => {
        console.error("[SW] registration failed:", err);
      });
  }, []);
  return null;
}
