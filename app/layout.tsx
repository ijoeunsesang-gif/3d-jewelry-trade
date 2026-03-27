import "./globals.css";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import { Toaster } from "react-hot-toast";

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
        <Header />
        {children}
        <Footer />
        <Toaster
          position="top-center"
          containerStyle={{
            top: 80,
          }}
          toastOptions={{
            duration: 2500,
            style: {
              background: "#111827", // 🔥 검은색
              color: "#ffffff",     // 🔥 흰 글씨
              borderRadius: "12px",
              fontWeight: 700,
              padding: "12px 16px",
            },
          }}
        />
      </body>
    </html>
  );
}
