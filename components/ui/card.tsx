import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

type Props = HTMLAttributes<HTMLDivElement> & {
  /** "glow" ajoute un léger halo au survol — utile pour les cartes cliquables/mises en avant. */
  variant?: "default" | "glow";
};

export function Card({ className, variant = "default", ...props }: Props) {
  return (
    <div
      className={cn(
        "rounded-xl2 border border-white/10 bg-white/[0.03] backdrop-blur-xl shadow-card p-5 transition-all duration-300",
        variant === "glow" && "hover:border-brand-500/30 hover:shadow-glow hover:-translate-y-0.5",
        className
      )}
      {...props}
    />
  );
}
