"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

/**
 * Page d'arrivée du lien "Sign in" envoyé par Supabase.
 *
 * Avec le flux "implicit" (voir lib/supabase/client.ts), le lien redirige ici avec la session
 * encodée directement dans le fragment d'URL (#access_token=...&refresh_token=...). Le SDK
 * Supabase la détecte et l'installe automatiquement dès son initialisation côté navigateur —
 * ça fonctionne même si l'email a été ouvert sur un autre appareil que celui utilisé pour
 * demander le lien, contrairement au flux "pkce" (par défaut) qui exigeait le même navigateur.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    (async () => {
      // getSession() attend que le SDK ait fini de traiter le fragment d'URL le cas échéant.
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) {
        router.replace("/completer-profil");
      } else {
        setError(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-16 bg-aurora relative">
      <Card className="w-full max-w-sm text-center">
        {error ? (
          <>
            <h1 className="text-lg font-bold text-white mb-2">Lien invalide ou expiré</h1>
            <p className="text-sm text-white/60 mb-4">
              Ce lien de connexion n&apos;est plus valable (déjà utilisé, ou trop ancien). Redemande un nouveau
              lien depuis la page de connexion.
            </p>
            <a href="/connexion" className="text-sm font-semibold text-brand-400 hover:underline">
              Retour à la connexion →
            </a>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 className="w-6 h-6 text-brand-400 animate-spin" />
            <p className="text-sm text-white/60">Connexion en cours...</p>
          </div>
        )}
      </Card>
    </main>
  );
}
