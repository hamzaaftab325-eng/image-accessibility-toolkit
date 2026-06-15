import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AltForge - AI Alt Text & Image Format Converter",
  description: "Generate AI-powered alt text for web accessibility and convert image formats instantly. Bulk upload up to 15 images.",
  keywords: ["alt text", "accessibility", "image converter", "WebP", "AI", "SEO", "screen reader", "image format"],
  authors: [{ name: "AltForge" }],
  icons: {
    icon: [
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "AltForge - AI Alt Text & Image Format Converter",
    description: "Generate AI-powered alt text for accessibility and convert image formats.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "AltForge - AI Alt Text & Image Format Converter",
    description: "Generate AI-powered alt text for accessibility and convert image formats.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
