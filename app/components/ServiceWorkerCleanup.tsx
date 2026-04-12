"use client";
import { useEffect } from "react";

export default function ServiceWorkerCleanup() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(registration => {
          registration.unregister();
          console.log('[SW] unregistered:', registration.scope);
        });
      });
    }
  }, []);
  return null;
}
