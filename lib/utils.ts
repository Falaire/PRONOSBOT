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
/**
 * Seuils calibrés sur le TAUX DE RÉALISATION observé, pas sur une échelle subjective.
 * `confidence` est désormais la probabilité du favori remise à l'échelle par la qualité de donnée
 * (lib/prediction/engine.ts) — donc un nombre qui se vérifie après coup.
 * Mesure : 19 980 matchs rejoués avec le moteur corrigé (999 de test / 18 981 d'historique) :
 *   confiance >= 56 -> 69.0 % / 69.0 % de victoires du favori réellement réalisées
 *   confiance >= 50 -> 62.4 % / 64.6 %
 *   confiance >= 45 -> 57.5 % / 61.1 %
 *   confiance <  45 -> 42.9 % / 43.3 %
 * (Les anciens seuils 75/60/45 avaient été réglés sur l'échelle inventée « 50 + écart×100 », où 75
 *  était courant : sur la nouvelle échelle, « Très forte confiance » ne s'afficherait plus jamais.)
 */
export function confidenceLabel(confidence: number): { label: string; color: string } {
  if (confidence >= 56) return { label: "Très forte confiance", color: "text-brand-500" };
  if (confidence >= 50) return { label: "Bonne confiance", color: "text-accent-500" };
  if (confidence >= 45) return { label: "Confiance modérée", color: "text-orange-400" };
  return { label: "Prudence, match imprévisible", color: "text-red-400" };
}
