/**
 * Validation/normalisation légère des numéros togolais (+228).
 * Ce n'est PAS une vérification réelle (pas d'envoi de SMS/appel) — juste un contrôle de
 * format qui élimine les saisies farfelues (chiffres au hasard, numéros trop courts/longs).
 * Combiné à la contrainte d'unicité en base (une seule fois par numéro), ça suffit à limiter
 * l'abus « essai gratuit » basique (rotation d'emails jetables en gardant le même téléphone),
 * sans dépendre d'un fournisseur SMS payant (Twilio).
 */

/** Normalise en E.164 (+228XXXXXXXX). Accepte avec ou sans indicatif, espaces, tirets... */
export function toE164Togo(input: string): string {
  const digits = input.replace(/\D/g, "");
  const local = digits.startsWith("228") ? digits.slice(3) : digits;
  return `+228${local}`;
}

/** Numéro mobile togolais plausible : 8 chiffres locaux, commence par 6, 7 ou 9. */
export function isValidTogoPhone(input: string): boolean {
  const digits = input.replace(/\D/g, "");
  const local = digits.startsWith("228") ? digits.slice(3) : digits;
  return /^[679]\d{7}$/.test(local);
}
