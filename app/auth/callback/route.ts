import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Point d'arrivée du lien "Sign in" envoyé par Supabase (flux magic link / PKCE).
 *
 * Sur le plan gratuit, Supabase ne permet pas d'éditer le contenu de l'email de connexion
 * (il faudrait un SMTP personnalisé pour afficher {{ .Token }} à la place du lien) : l'email
 * envoyé ne contient donc qu'un lien cliquable, pas de code à taper. On gère ici ce lien
 * directement, en échangeant le "code" d'autorisation contre une vraie session — après ça,
 * l'utilisateur est connecté sans avoir eu besoin de saisir quoi que ce soit.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // /completer-profil redirige lui-même vers /dashboard si le numéro est déjà enregistré.
      return NextResponse.redirect(`${origin}/completer-profil`);
    }
  }

  return NextResponse.redirect(`${origin}/connexion?erreur=lien_invalide`);
}
