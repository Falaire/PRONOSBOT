/**
 * "Rester connecté" : limitation technique importante à savoir (honnêteté, comme le reste du
 * projet) — la version de @supabase/ssr utilisée par le projet (0.4.x) force la durée de vie du
 * cookie de session Supabase à une valeur très longue à chaque écriture, quelle que soit la
 * valeur qu'on lui demande (bug/limitation connue de cette version de la librairie). On ne peut
 * donc pas directement "raccourcir" le cookie de session Supabase lui-même pour qu'il expire à
 * la fermeture du navigateur.
 *
 * Pour quand même respecter le choix de l'utilisateur, on ajoute une couche applicative avec
 * deux petits cookies qu'on gère nous-mêmes (non sensibles, juste des marqueurs) :
 *  - kp_remember_me : persistant (longue durée), mémorise le dernier choix explicite.
 *  - kp_session_active : cookie DE SESSION (pas de durée de vie) posé en même temps — il
 *    disparaît automatiquement quand le navigateur est complètement fermé.
 *
 * Le middleware (middleware.ts) vérifie à chaque requête : si kp_remember_me = "0" (l'utilisateur
 * a explicitement demandé à NE PAS rester connecté) ET que kp_session_active a disparu (donc le
 * navigateur a été fermé puis rouvert), on déconnecte automatiquement la session Supabase encore
 * active. Résultat pour l'utilisateur : exactement le comportement attendu (reste connecté tant
 * que le navigateur reste ouvert, déconnecté à la prochaine ouverture sinon) — même si on ne
 * contrôle pas directement la durée de vie du cookie Supabase sous-jacent.
 */
export const REMEMBER_ME_COOKIE = "kp_remember_me";
export const SESSION_ACTIVE_COOKIE = "kp_session_active";
const REMEMBER_ME_MAX_AGE_SECONDS = 60 * 60 * 24 * 180; // 180 jours

/** À appeler côté client juste après une connexion réussie, avant de rediriger. */
export function setRememberCookies(remember: boolean) {
  if (typeof document === "undefined") return;
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  // kp_remember_me : persistant, mémorise le choix.
  document.cookie = `${REMEMBER_ME_COOKIE}=${remember ? "1" : "0"}; Path=/; Max-Age=${REMEMBER_ME_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
  // kp_session_active : cookie de session (pas de Max-Age/Expires) — disparaît à la fermeture du navigateur.
  document.cookie = `${SESSION_ACTIVE_COOKIE}=1; Path=/; SameSite=Lax${secure}`;
}

/** À appeler côté client lors d'une déconnexion manuelle, pour repartir d'un état propre. */
export function clearRememberCookies() {
  if (typeof document === "undefined") return;
  document.cookie = `${REMEMBER_ME_COOKIE}=; Path=/; Max-Age=0`;
  document.cookie = `${SESSION_ACTIVE_COOKIE}=; Path=/; Max-Age=0`;
}
