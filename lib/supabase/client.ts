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
  return createBrowserClient(url, anonKey);
}
