import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Cinzel, Noto_Sans_KR } from "next/font/google";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["700"],
  variable: "--font-cormorant",
  display: "swap",
});

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["700"],
  variable: "--font-cinzel",
  display: "swap",
});

// Noto Sans KR(CJK 폰트)는 next/font/google에 "korean" subset 항목이 없다 —
// 한글 글리프는 latin/latin-ext/cyrillic/vietnamese 선택과 무관하게 기본으로 포함되므로
// subsets:["latin"]이 한글을 누락시키는 것은 아니다. 여기서는 로딩 위치만 layout.tsx로 일원화.
const notoSansKR = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["700"],
  variable: "--font-noto-sans-kr",
  display: "swap",
});
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import PwaInstallPrompt from "@/app/components/PwaInstallPrompt";
import PwaInstallButton from "@/app/components/PwaInstallButton";
import { Toaster } from "react-hot-toast";
import ServiceWorkerCleanup from "@/app/components/ServiceWorkerCleanup";
import ProgressToast from "@/app/components/ProgressToast";

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
  verification: {
    google: "lL4463HFrfheDHxr3aIJVLkzLUwELGsE3c1jJWG7vhA",
    other: {
      "naver-site-verification": "dad60eb2f45afb39780aad36db71d63c2cc2351d",
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className={`${cormorant.variable} ${cinzel.variable} ${notoSansKR.variable}`}>
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
        <ProgressToast />
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
      </body>
    </html>
  );
}
