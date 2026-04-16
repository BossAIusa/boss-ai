import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Boss.AI — Smart Scheduling",
  description: "AI-powered employee scheduling platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
