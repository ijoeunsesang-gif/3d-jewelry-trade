import type { Metadata, Viewport } from "next";
import "./globals.css";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import PwaInstallPrompt from "@/app/components/PwaInstallPrompt";
import PwaInstallButton from "@/app/components/PwaInstallButton";
import { Toaster } from "react-hot-toast";
import ServiceWorkerCleanup from "@/app/components/ServiceWorkerCleanup";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#C9A84C",
};

export const metadata: Metadata = {
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "3D마켓",
  },
  icons: {
    apple: "/icon-192.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          background: "#f8fafc",
          fontFamily:
            'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <ServiceWorkerCleanup />
        <Header />
        {children}
        <Footer />
        <PwaInstallPrompt />
        <PwaInstallButton />
        <Toaster
          position="top-center"
          containerStyle={{ top: 80 }}
          toastOptions={{
            duration: 2500,
            style: {
              background: "#ffffff",
              color: "#111827",
              border: "1px solid #e5e7eb",
              borderRadius: "12px",
              fontWeight: 600,
              fontSize: "14px",
              padding: "10px 16px",
              boxShadow: "0 4px 16px rgba(15,23,42,0.08)",
            },
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js').then(function(reg) {
    reg.addEventListener('updatefound', function() {
      var newSW = reg.installing;
      if (!newSW) return;
      newSW.addEventListener('statechange', function() {
        // 새 SW가 activated되면 페이지 자동 새로고침
        if (newSW.state === 'activated') {
          window.location.reload();
        }
      });
    });
  });
  // SW로부터 SW_UPDATED 메시지를 받아도 새로고침
  navigator.serviceWorker.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'SW_UPDATED') {
      window.location.reload();
    }
  });
}
            `,
          }}
        />
      </body>
    </html>
  );
}
