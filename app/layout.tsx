import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Navbar } from "@/components/shared/Navbar";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "English Quiz — 2,262 Smart MCQs",
  description:
    "Practice 2,262 multiple-choice English questions with adaptive progress tracking, dark mode, and detailed analytics.",
  keywords: [
    "English quiz",
    "MCQ",
    "Grammar practice",
    "Vocabulary",
    "Tenses",
    "English learning",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="font-sans">
        <Providers>
          <Navbar />
          <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 md:py-10">
            {children}
          </main>
          <footer className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
            Built with Next.js · Tailwind · Framer Motion · Zustand · Recharts
          </footer>
        </Providers>
      </body>
    </html>
  );
}
