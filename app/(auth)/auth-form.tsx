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
      options: { shouldCreateUser: true },
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
    router.push("/dashboard");
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
        <form onSubmit={verifyOtp} className="space-y-4">
          <div>
            <label className="text-sm text-white/70 flex items-center gap-1">
              <ShieldCheck className="w-4 h-4" /> Code reçu par email
            </label>
            <input
              required
              inputMode="numeric"
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="mt-1 w-full rounded-lg bg-white/5 border border-white/15 px-3 py-2 text-white text-sm placeholder:text-white/30 tracking-widest"
            />
          </div>
          <p className="text-xs text-white/40">
            Vérifie aussi tes spams si le message n&apos;arrive pas au bout de 2 minutes.
          </p>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Vérification..." : "Confirmer"}
          </Button>
        </form>
      )}
    </Card>
  );
}
