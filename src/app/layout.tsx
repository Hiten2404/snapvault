import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SnapVault — Restore & Organize Snapchat Memories",
  description: "SnapVault helps you restore metadata, manage, browse, and export Snapchat Memories locally in your browser.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full dark">
      <body
        className={`${inter.variable} font-sans h-full bg-neutral-950 text-neutral-100 antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
