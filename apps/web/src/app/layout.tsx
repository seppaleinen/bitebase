import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { TRPCProvider } from "@/lib/trpc/provider";

export const metadata: Metadata = {
  title: "BiteBase — Bite-sized Learning",
  description:
    "Tell BiteBase what you want to learn, and it builds a personalized, quiz-filled curriculum just for you.",
};

const fraunces = localFont({
  src: [
    {
      path: "./fonts/fraunces-latin-ext.woff2",
      weight: "100 900",
      style: "normal",
    },
    {
      path: "./fonts/fraunces-latin.woff2",
      weight: "100 900",
      style: "normal",
    },
  ],
  variable: "--font-fraunces",
  display: "swap",
});

const literata = localFont({
  src: [
    {
      path: "./fonts/literata.woff2",
      weight: "100 900",
      style: "normal",
    },
  ],
  variable: "--font-literata",
  display: "swap",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${fraunces.variable} ${literata.variable}`}>
      <body>
        <TRPCProvider>{children}</TRPCProvider>
      </body>
    </html>
  );
}
