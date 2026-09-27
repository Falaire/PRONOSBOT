"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, ShieldCheck } from "lucide-react";

/**
 * Authentification par numéro de téléphone + code OTP (SMS), via Supabase Auth.
 * Plus adaptée au marché togolais que l'email : le numéro Mobile Money sert aussi
 * d'identifiant unique et de moyen de contact pour les alertes.
 */
export function AuthForm({ mode }: { mode: "connexion" | "inscription" }) {
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  function toE164(input: string): string {
    const digits = input.replace(/\D/g, "");
    if (digits.startsWith("228")) return `+${digits}`;
    return `+228${digits}`; // indicatif Togo par défaut
  }

  // "sms" (Twilio SMS/Twilio Verify) ou "whatsapp" (Twilio + canal WhatsApp, moins cher et très
  // utilisé au Togo) — voir docs/10-sms-otp-setup.md pour la configuration côté Supabase/Twilio.
  const otpChannel = (process.env.NEXT_PUBLIC_OTP_CHANNEL === "whatsapp" ? "whatsapp" : "sms") as
    | "sms"
    | "whatsapp";

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      phone: toE164(phone),
      options: { channel: otpChannel },
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
      phone: toE164(phone),
      token: code,
      type: "sms",
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
          : "Connectez-vous avec votre numéro de téléphone."}
      </p>

      {step === "phone" ? (
        <form onSubmit={sendOtp} className="space-y-4">
          <div>
            <label className="text-sm text-white/70 flex items-center gap-1">
              <Phone className="w-4 h-4" /> Numéro de téléphone
            </label>
            <input
              required
              type="tel"
              placeholder="90 00 00 00"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-lg bg-white/5 border border-white/15 px-3 py-2 text-white text-sm placeholder:text-white/30"
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Envoi..." : otpChannel === "whatsapp" ? "Recevoir le code par WhatsApp" : "Recevoir le code par SMS"}
          </Button>
        </form>
      ) : (
        <form onSubmit={verifyOtp} className="space-y-4">
          <div>
            <label className="text-sm text-white/70 flex items-center gap-1">
              <ShieldCheck className="w-4 h-4" /> Code reçu par {otpChannel === "whatsapp" ? "WhatsApp" : "SMS"}
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
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Vérification..." : "Confirmer"}
          </Button>
        </form>
      )}
    </Card>
  );
}
