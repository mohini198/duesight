import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AGENT-OS // Autonomous Task Platform",
  description: "Multi-agent AI task automation platform with self-reflection and human-in-the-loop control",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
  
}) {
  return (
    <html lang="en">
      <body className="scanlines">
        {children}
      </body>
    </html>
  );
}