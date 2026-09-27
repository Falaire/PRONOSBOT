import { cn } from "@/lib/utils";
import Link from "next/link";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "outline";
type Size = "sm" | "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary: "bg-brand-500 text-white hover:bg-brand-600 shadow-lg shadow-brand-500/20",
  secondary: "bg-accent-500 text-ink-900 hover:bg-accent-600",
  ghost: "bg-transparent text-white hover:bg-white/10",
  outline: "border border-white/20 text-white hover:bg-white/5",
};

const sizeClasses: Record<Size, string> = {
  sm: "text-sm px-3 py-1.5 rounded-lg",
  md: "text-sm px-5 py-2.5 rounded-xl",
  lg: "text-base px-7 py-3.5 rounded-xl2",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  href?: string;
};

export function Button({ variant = "primary", size = "md", className, href, children, ...props }: Props) {
  const classes = cn(
    "inline-flex items-center justify-center gap-2 font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none",
    variantClasses[variant],
    sizeClasses[size],
    className
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}
