"use client";

import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  /** Adds a subtle hover lift. Used for clickable stat cards. */
  interactive?: boolean;
  /** Glassmorphism treatment. */
  glass?: boolean;
};

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, interactive, glass, children, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        "rounded-2xl border shadow-soft",
        "bg-white/80 border-slate-200/70",
        "dark:bg-slate-900/60 dark:border-slate-800/70",
        "backdrop-blur-sm",
        glass &&
          "bg-white/60 dark:bg-slate-900/40 border-white/40 dark:border-slate-700/40",
        interactive &&
          "transition-all duration-200 hover:-translate-y-1 hover:shadow-glow cursor-pointer",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
});

export function CardHeader({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("px-6 pt-5 pb-3 border-b border-slate-200/60 dark:border-slate-800/60", className)}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardBody({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("p-6", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "text-lg font-semibold text-slate-900 dark:text-slate-100",
        className,
      )}
      {...rest}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-sm text-slate-500 dark:text-slate-400 mt-1", className)}
      {...rest}
    >
      {children}
    </p>
  );
}
