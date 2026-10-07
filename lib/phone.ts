/**
 * Validation/normalisation légère des numéros de téléphone, pour toute l'Afrique (plus
 * seulement le Togo). Ce n'est PAS une vérification réelle (pas d'envoi de SMS/appel) — juste
 * un contrôle de format qui élimine les saisies farfelues (chiffres au hasard, numéros trop
 * courts/longs). Combiné à la contrainte d'unicité en base (une seule fois par numéro), ça
 * suffit à limiter l'abus « essai gratuit » basique (rotation d'emails jetables en gardant le
 * même téléphone), sans dépendre d'un fournisseur SMS payant (Twilio).
 */

/**
 * Normalise en E.164 (+indicatifXXXXXXXX). Accepte avec ou sans indicatif, espaces, tirets...
 * Rétrocompatibilité : un numéro local togolais à 8 chiffres (sans indicatif) est toujours
 * préfixé automatiquement par +228, comme avant l'ouverture multi-pays.
 */
export function toE164Phone(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 8 && /^[679]/.test(digits)) {
    return `+228${digits}`;
  }
  return `+${digits}`;
}

/**
 * Numéro plausible : soit un numéro local togolais à 8 chiffres (6/7/9 ...), soit un numéro
 * international complet avec indicatif pays (9 à 15 chiffres au total, norme E.164), ce qui
 * couvre les indicatifs des pays africains desservis (+221 Sénégal, +225 Côte d'Ivoire,
 * +229 Bénin, +233 Ghana, +234 Nigeria, +243 RDC, etc.).
 */
export function isValidPhone(input: string): boolean {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 8 && /^[679]/.test(digits)) return true;
  return digits.length >= 9 && digits.length <= 15;
}
