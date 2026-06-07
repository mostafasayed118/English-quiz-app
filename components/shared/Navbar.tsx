"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, BarChart3, Home, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";

const NAV = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/quiz", label: "Quiz", icon: BookOpen },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

export function Navbar() {
  const pathname = usePathname();
  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b backdrop-blur-md",
        "border-slate-200/70 bg-white/70",
        "dark:border-slate-800/70 dark:bg-slate-950/70",
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="relative">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-glow">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
              English Quiz
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              2,262 MCQs · Smart Practice
            </span>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  active
                    ? "text-primary-700 dark:text-primary-300"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 -z-10 rounded-lg bg-primary-100 dark:bg-primary-900/40"
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden border-t border-slate-200/70 dark:border-slate-800/70">
        <div className="mx-auto flex max-w-7xl items-center justify-around px-2">
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors",
                  active
                    ? "text-primary-600 dark:text-primary-300"
                    : "text-slate-500 dark:text-slate-400",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
