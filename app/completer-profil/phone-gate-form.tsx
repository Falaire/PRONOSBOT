"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PasswordStrengthMeter } from "@/components/PasswordStrengthMeter";
import { isPasswordValid, PASSWORD_REQUIREMENTS_TEXT } from "@/lib/password-strength";
import { Phone, Gift, KeyRound, Eye, EyeOff } from "lucide-react";

/**
 * Étapes obligatoires après l'inscription par email, avant d'accéder au tableau de bord :
 *  1. Numéro de téléphone — limite l'abus de l'essai gratuit (un numéro = un seul essai, pour
 *     toujours) sans dépendre d'un envoi de SMS payant. Voir app/api/account/complete-signup.
 *  2. Code de sécurité (lettres + chiffres + caractère spécial) — une fois défini, les prochaines
 *     connexions se font avec email + ce code (supabase.auth.signInWithPassword), sans devoir
 *     renvoyer un email à chaque fois. Le lien par email reste toujours disponible en secours si
 *     le code est oublié.
 */
export function PhoneGateForm() {
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeConfirm, setCodeConfirm] = useState("");
  const [showCode, setShowCode] = useState(false);
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

  async function submitPhone(e: React.FormEvent) {
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
      setStep("code");
    } catch (e: any) {
      setError(e.message ?? "Erreur");
    } finally {
      setLoading(false);
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isPasswordValid(code)) {
      setError(`Code trop faible. ${PASSWORD_REQUIREMENTS_TEXT}`);
      return;
    }
    if (code !== codeConfirm) {
      setError("Les deux codes ne correspondent pas.");
      return;
    }
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: code });
      if (updateError) throw updateError;
      // Rechargement complet (pas router.push) : le lien "Pronostics" du menu précharge
      // /dashboard en arrière-plan dès l'affichage de cette page, avec l'ancien état (numéro
      // absent) mis en cache côté navigation. Un push client réutiliserait ce cache et
      // renverrait l'utilisateur ici en boucle — un rechargement complet force une lecture
      // fraîche du profil côté serveur.
      window.location.href = "/dashboard";
    } catch (e: any) {
      setError(e.message ?? "Erreur");
    } finally {
      setLoading(false);
    }
  }

  if (checking) return null;

  if (step === "phone") {
    return (
      <Card className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-1">
          <Gift className="w-5 h-5 text-accent-500" />
          <h1 className="text-xl font-bold text-white">Dernière étape</h1>
        </div>
        <p className="text-sm text-white/60 mb-5">
          Ton numéro de téléphone active ton essai gratuit de 3 jours et sert aux alertes WhatsApp et
          au paiement Mobile Money. Un seul essai gratuit par numéro. Numéro togolais ou numéro
          international avec l&apos;indicatif de ton pays.
        </p>
        <form onSubmit={submitPhone} className="space-y-4">
          <div>
            <label className="text-sm text-white/70 flex items-center gap-1">
              <Phone className="w-4 h-4" /> Numéro de téléphone (WhatsApp)
            </label>
            <input
              required
              type="tel"
              placeholder="90 12 34 56 ou +225 01 02 03 04 05"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-lg bg-white/5 border border-white/15 px-3 py-2 text-white text-sm placeholder:text-white/30"
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Validation..." : "Continuer"}
          </Button>
        </form>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm">
      <div className="flex items-center gap-2 mb-1">
        <KeyRound className="w-5 h-5 text-accent-500" />
        <h1 className="text-xl font-bold text-white">Crée ton code de sécurité</h1>
      </div>
      <p className="text-sm text-white/60 mb-5">
        Un code personnel pour te reconnecter plus tard avec ton email + ce code — sans attendre un nouvel
        email à chaque fois. Tu pourras toujours te connecter par email si tu l&apos;oublies.
      </p>
      <form onSubmit={submitCode} className="space-y-4">
        <div>
          <label className="text-sm text-white/70 flex items-center gap-1">
            <KeyRound className="w-4 h-4" /> Code de sécurité
          </label>
          <div className="relative mt-1">
            <input
              required
              type={showCode ? "text" : "password"}
              placeholder="Ex : Africa2024!"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full rounded-lg bg-white/5 border border-white/15 px-3 py-2 pr-10 text-white text-sm placeholder:text-white/30"
            />
            <button
              type="button"
              onClick={() => setShowCode((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
              tabIndex={-1}
            >
              {showCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <PasswordStrengthMeter password={code} />
          <p className="text-xs text-white/40 mt-1">{PASSWORD_REQUIREMENTS_TEXT}</p>
        </div>
        <div>
          <label className="text-sm text-white/70 flex items-center gap-1">
            <KeyRound className="w-4 h-4" /> Confirme le code
          </label>
          <input
            required
            type={showCode ? "text" : "password"}
            placeholder="Ex : Africa2024!"
            value={codeConfirm}
            onChange={(e) => setCodeConfirm(e.target.value)}
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
