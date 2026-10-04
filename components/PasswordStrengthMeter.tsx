"use client";

import { getPasswordStrength } from "@/lib/password-strength";

/** Barre de robustesse affichée sous un champ de code de sécurité pendant la saisie. */
export function PasswordStrengthMeter({ password }: { password: string }) {
  if (!password) return null;
  const { label, color, percent } = getPasswordStrength(password);
  return (
    <div className="mt-1.5">
      <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-200 ${color}`} style={{ width: `${percent}%` }} />
      </div>
      <p className="text-xs text-white/50 mt-1">
        Sécurité : <span className="font-semibold text-white/70">{label}</span>
      </p>
    </div>
  );
}
