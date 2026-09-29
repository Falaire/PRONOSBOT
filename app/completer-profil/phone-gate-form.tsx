"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, Gift } from "lucide-react";

/**
 * Étape obligatoire après l'inscription par email : demande le numéro de téléphone avant de
 * donner accès au tableau de bord. Sert à limiter l'abus de l'essai gratuit (un numéro = un
 * seul essai, pour toujours) sans dépendre d'un envoi de SMS payant — voir
 * app/api/account/complete-signup/route.ts.
 */
export function PhoneGateForm() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  // Si l'utilisateur a déjà un numéro enregistré (ou n'est pas connecté), on ne s'attarde pas ici.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/connexion");
        return;
      }
      const { data: profile } = await supabase.from("profiles").select("phone").eq("id", user.id).maybeSingle();
      if (!cancelled) {
        if (profile?.phone) {
          router.replace("/dashboard");
        } else {
          setChecking(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/account/complete-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erreur");
      // Rechargement complet (pas router.push) : le lien "Pronostics" du menu précharge
      // /dashboard en arrière-plan dès l'affichage de cette page, avec l'ancien état
      // (numéro absent) mis en cache côté navigation. Un push client réutiliserait ce cache
      // et renverrait l'utilisateur ici en boucle — un rechargement complet force une lecture
      // fraîche du profil (numéro bien enregistré) côté serveur.
      window.location.href = "/dashboard";
    } catch (e: any) {
      setError(e.message ?? "Erreur");
    } finally {
      setLoading(false);
    }
  }

  if (checking) return null;

  return (
    <Card className="w-full max-w-sm">
      <div className="flex items-center gap-2 mb-1">
        <Gift className="w-5 h-5 text-accent-500" />
        <h1 className="text-xl font-bold text-white">Dernière étape</h1>
      </div>
      <p className="text-sm text-white/60 mb-5">
        Ton numéro de téléphone active ton essai gratuit de 3 jours et sert aux alertes WhatsApp et
        au paiement Mobile Money. Un seul essai gratuit par numéro.
      </p>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="text-sm text-white/70 flex items-center gap-1">
            <Phone className="w-4 h-4" /> Numéro de téléphone (Togo)
          </label>
          <input
            required
            type="tel"
            placeholder="90 12 34 56"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 w-full rounded-lg bg-white/5 border border-white/15 px-3 py-2 text-white text-sm placeholder:text-white/30"
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Validation..." : "Activer mon essai gratuit"}
        </Button>
      </form>
    </Card>
  );
}
