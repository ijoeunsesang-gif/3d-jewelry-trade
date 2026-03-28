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
          containerStyle={{ top: 116 }}
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
