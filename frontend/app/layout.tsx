// app/layout.tsx
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-TW">
      {/* 使用原本系統定義的背景色 #fdf8f3  */}
      <body className="bg-[#fdf8f3] min-h-screen">
        {/* 包覆 AuthProvider 以管理 Session 狀態 [cite: 199, 200] 與超時監控  */}
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}