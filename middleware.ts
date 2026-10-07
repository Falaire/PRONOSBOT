import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { REMEMBER_ME_COOKIE, SESSION_ACTIVE_COOKIE } from "@/lib/remember-me";

/**
 * Rafraîchit la session Supabase (cookies) à chaque requête — nécessaire avec @supabase/ssr
 * pour que les Server Components voient un utilisateur connecté à jour.
 * Applique aussi le choix "rester connecté ou non" fait à la connexion (voir lib/remember-me.ts
 * pour l'explication complète du mécanisme et sa limitation connue).
 * Tolérant : si les variables Supabase ne sont pas configurées, laisse passer la requête
 * (mode démo sans backend).
 */
export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request: { headers: request.headers } });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: any) {
        response.cookies.set({ name, value: "", ...options });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const rememberMe = request.cookies.get(REMEMBER_ME_COOKIE)?.value;
    const sessionActive = request.cookies.get(SESSION_ACTIVE_COOKIE)?.value;
    // L'utilisateur avait explicitement choisi de NE PAS rester connecté (kp_remember_me = "0"),
    // et kp_session_active (cookie de session, sans durée de vie) a disparu : le navigateur a
    // été fermé puis rouvert depuis la connexion. On déconnecte la session Supabase encore
    // active (son propre cookie survit plus longtemps, voir lib/remember-me.ts).
    // Absence totale de kp_remember_me (sessions créées avant l'ajout de cette fonctionnalité) :
    // on ne force PAS la déconnexion, pour ne pas surprendre des utilisateurs déjà connectés.
    if (rememberMe === "0" && !sessionActive) {
      await supabase.auth.signOut();
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

