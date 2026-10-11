"use client";

import { useState } from "react";
import { clearRememberCookies } from "@/lib/remember-me";
import { Button } from "@/components/ui/button";

export function SignOutButton({ className }: { className?: string }) {
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    // Import dynamique : Supabase n'est chargé que si l'utilisateur clique (perf).
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    await supabase.auth.signOut();
    clearRememberCookies();
    // Rechargement complet pour garantir que tous les composants serveur (Navbar, etc.)
    // relisent un état "déconnecté" frais, au lieu de rester sur une version mise en cache.
    window.location.href = "/";
  }

  return (
    <Button variant="ghost" size="sm" className={className} onClick={handleSignOut} disabled={loading}>
      {loading ? "..." : "Déconnexion"}
    </Button>
  );
}
