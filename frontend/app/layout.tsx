import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

// Fonts are loaded via @font-face in globals.css rather than next/font/google,
// so the production build never depends on reaching fonts.googleapis.com at
// build time — useful in offline/restricted CI environments. Swap in
// next/font/google if you prefer automatic self-hosting and have network
// access during build.

export const metadata: Metadata = {
  title: "Site Compliance — PPE Detection System",
  description: "Industrial PPE compliance monitoring powered by YOLOv8.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="font-body">
        {children}
        <Toaster theme="dark" position="top-right" richColors />
      </body>
    </html>
  );
}
