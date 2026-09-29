"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Client Supabase pour composants React côté navigateur ("use client").
 * Utilise des valeurs de repli en mode démo (sans .env configuré) afin que le build et le
 * rendu ne plantent pas avant la configuration réelle du projet Supabase.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://demo.supabase.co";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "demo-anon-key";
  return createBrowserClient(url, anonKey, {
    auth: {
      // Le flux "implicit" permet de cliquer le lien de connexion reçu par email depuis
      // n'importe quel appareil/navigateur (ex: email ouvert sur le téléphone alors que le
      // site est ouvert sur l'ordinateur). Le flux "pkce" (par défaut) échoue dans ce cas
      // précis car il exige que la demande et le clic viennent du même navigateur.
      flowType: "implicit",
    },
  });
}
