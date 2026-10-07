import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

type Tone = "brand" | "accent" | "neutral" | "danger";

const toneClasses: Record<Tone, string> = {
  brand: "bg-brand-500/15 text-brand-400 border-brand-500/30",
  accent: "bg-accent-500/15 text-accent-500 border-accent-500/30",
  neutral: "bg-white/10 text-white/80 border-white/15",
  danger: "bg-red-500/15 text-red-400 border-red-500/30",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium backdrop-blur-sm",
        toneClasses[tone],
        className
      )}
      {...props}
    />
  );
}
