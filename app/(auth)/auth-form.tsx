"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, ShieldCheck } from "lucide-react";

/**
 * Authentification par email + code OTP (6 chiffres), via Supabase Auth.
 * Utilise le service d'envoi d'email intégré à Supabase — aucun fournisseur externe
 * (Twilio, etc.) n'est nécessaire. Voir docs/10-sms-otp-setup.md pour augmenter le volume
 * d'envoi si besoin (SMTP personnalisé, ex: Resend).
 */
export function AuthForm({ mode }: { mode: "connexion" | "inscription" }) {
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        // Sur le plan gratuit Supabase, l'email de connexion ne peut afficher qu'un lien
        // cliquable (pas de code, ça nécessite un SMTP personnalisé) : on pointe donc ce
        // lien vers notre propre route qui termine la connexion automatiquement.
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setStep("otp");
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    // Le tableau de bord vérifie lui-même si le profil a un numéro enregistré et redirige
    // automatiquement vers /dashboard si c'est déjà le cas (connexion d'un compte existant).
    router.push("/completer-profil");
  }

  return (
    <Card className="w-full max-w-sm">
      <h1 className="text-xl font-bold text-white mb-1">
        {mode === "inscription" ? "Créer un compte" : "Connexion"}
      </h1>
      <p className="text-sm text-white/60 mb-5">
        {mode === "inscription"
          ? "3 jours d'essai gratuit, sans carte bancaire."
          : "Connectez-vous avec votre adresse email."}
      </p>

      {step === "email" ? (
        <form onSubmit={sendOtp} className="space-y-4">
          <div>
            <label className="text-sm text-white/70 flex items-center gap-1">
              <Mail className="w-4 h-4" /> Adresse email
            </label>
            <input
              required
              type="email"
              placeholder="toi@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg bg-white/5 border border-white/15 px-3 py-2 text-white text-sm placeholder:text-white/30"
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Envoi..." : "Recevoir le code par email"}
          </Button>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-accent-500/30 bg-accent-500/10 px-3 py-3 text-sm text-white/80">
            <p className="font-semibold text-white mb-1">Vérifie ta boîte email 📩</p>
            <p>
              On vient d&apos;envoyer un email à <span className="text-white">{email}</span>. Ouvre-le et clique
              sur le bouton <span className="font-semibold">« Sign in »</span> qu&apos;il contient : tu seras
              connecté automatiquement, sans rien taper.
            </p>
          </div>
          <p className="text-xs text-white/40">
            Vérifie aussi tes spams si le message n&apos;arrive pas au bout de 2 minutes.
          </p>

          <details className="text-xs text-white/50">
            <summary className="cursor-pointer select-none text-white/60 hover:text-white/80">
              Tu as reçu un code à la place d&apos;un lien ?
            </summary>
            <form onSubmit={verifyOtp} className="space-y-3 mt-3">
              <div>
                <label className="text-sm text-white/70 flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4" /> Code reçu par email
                </label>
                <input
                  inputMode="numeric"
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-white/5 border border-white/15 px-3 py-2 text-white text-sm placeholder:text-white/30 tracking-widest"
                />
              </div>
              <Button type="submit" disabled={loading || !code} className="w-full">
                {loading ? "Vérification..." : "Confirmer le code"}
              </Button>
            </form>
          </details>

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      )}
    </Card>
  );
}
