import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatFcfa(amount: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(amount) + " FCFA";
}

export function formatDateTimeLome(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Africa/Lome",
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/**
 * Seuils volontairement réalistes : en football, un net favori dépasse rarement 75-80% de
 * probabilité (contrairement à d'autres sports), donc exiger 80%+ pour "forte confiance" laisse
 * la quasi-totalité des pronostics dans la case basse, même quand le modèle est confiant.
 * 60%+ est déjà un bon niveau de certitude statistique pour un match de foot.
 */
export function confidenceLabel(confidence: number): { label: string; color: string } {
  if (confidence >= 75) return { label: "Très forte confiance", color: "text-brand-500" };
  if (confidence >= 60) return { label: "Bonne confiance", color: "text-accent-500" };
  if (confidence >= 45) return { label: "Confiance modérée", color: "text-orange-400" };
  return { label: "Prudence, match imprévisible", color: "text-red-400" };
}
