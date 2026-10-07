/**
 * Règles et évaluation de robustesse pour le "code de sécurité" (mot de passe) utilisé pour se
 * reconnecter avec email + code, sans attendre un nouvel email à chaque fois.
 *
 * Règles minimales exigées : au moins 8 caractères, avec au moins une lettre, un chiffre et un
 * caractère spécial. Les niveaux de sécurité affichés à l'utilisateur vont au-delà de ce minimum
 * (longueur, majuscules/minuscules mélangées) pour encourager des codes plus robustes.
 */

export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_REQUIREMENTS_TEXT =
  "Au moins 8 caractères, avec au moins une lettre, un chiffre et un caractère spécial (ex : ! @ # ? -).";

const HAS_LETTER = /[a-zA-Z]/;
const HAS_LOWER = /[a-z]/;
const HAS_UPPER = /[A-Z]/;
const HAS_DIGIT = /\d/;
const HAS_SPECIAL = /[^A-Za-z0-9]/;

/** Vérifie que le code respecte le minimum exigé (lettre + chiffre + caractère spécial, 8+ car.). */
export function isPasswordValid(password: string): boolean {
  return (
    password.length >= PASSWORD_MIN_LENGTH &&
    HAS_LETTER.test(password) &&
    HAS_DIGIT.test(password) &&
    HAS_SPECIAL.test(password)
  );
}

export type PasswordStrength = {
  score: number; // 0 (très faible) à 4 (très fort)
  label: string;
  color: string; // classe Tailwind pour la barre
  percent: number;
};

const LEVELS: PasswordStrength[] = [
  { score: 0, label: "Très faible", color: "bg-red-500", percent: 20 },
  { score: 1, label: "Faible", color: "bg-orange-500", percent: 40 },
  { score: 2, label: "Moyen", color: "bg-yellow-500", percent: 60 },
  { score: 3, label: "Fort", color: "bg-lime-500", percent: 80 },
  { score: 4, label: "Très fort", color: "bg-green-500", percent: 100 },
];

/** Évalue la robustesse d'un mot de passe pour un indicateur visuel (barre + libellé). */
export function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return LEVELS[0];
  let score = 0;
  if (password.length >= PASSWORD_MIN_LENGTH) score++;
  if (password.length >= 12) score++;
  if (HAS_LOWER.test(password) && HAS_UPPER.test(password)) score++;
  if (HAS_DIGIT.test(password)) score++;
  if (HAS_SPECIAL.test(password)) score++;
  const idx = Math.min(score, LEVELS.length - 1);
  return LEVELS[idx];
}
