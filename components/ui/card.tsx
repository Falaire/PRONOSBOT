import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl2 border border-white/10 bg-ink-800/60 backdrop-blur p-5 shadow-xl shadow-black/20",
        className
      )}
      {...props}
    />
  );
}
