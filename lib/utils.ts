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

export function confidenceLabel(confidence: number): { label: string; color: string } {
  if (confidence >= 80) return { label: "Très forte confiance", color: "text-brand-500" };
  if (confidence >= 65) return { label: "Confiance solide", color: "text-accent-500" };
  if (confidence >= 50) return { label: "Confiance modérée", color: "text-orange-400" };
  return { label: "Prudence", color: "text-red-400" };
}
