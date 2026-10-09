import { cn } from "@/lib/utils";
import Link from "next/link";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "outline";
type Size = "sm" | "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-gradient-to-b from-brand-400 to-brand-600 text-white shadow-glow hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0",
  secondary:
    "bg-gradient-to-b from-accent-400 to-accent-600 text-ink-950 shadow-glow-accent hover:brightness-105 hover:-translate-y-0.5 active:translate-y-0",
  ghost: "bg-transparent text-white/80 hover:text-white hover:bg-white/10",
  outline: "border border-white/15 text-white hover:border-white/30 hover:bg-white/5",
};

const sizeClasses: Record<Size, string> = {
  sm: "text-sm px-3.5 py-1.5 rounded-full",
  md: "text-sm px-5 py-2.5 rounded-full",
  lg: "text-base px-8 py-3.5 rounded-full",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  href?: string;
};

/** Classes du bouton, réutilisables sur un lien/élément personnalisé (ex: lien avec point de notification). */
export function buttonClasses({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: Variant;
  size?: Size;
  className?: string;
} = {}): string {
  return cn(
    "inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none disabled:translate-y-0",
    variantClasses[variant],
    sizeClasses[size],
    className
  );
}

export function Button({ variant = "primary", size = "md", className, href, children, ...props }: Props) {
  const classes = buttonClasses({ variant, size, className });

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
