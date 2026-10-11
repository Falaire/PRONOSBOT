"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatFcfa } from "@/lib/utils";
import { Smartphone, MessageCircle, CheckCircle2 } from "lucide-react";
import { AnimatedBackground } from "@/components/motion/animated-background";

type Plan = { code: string; name: string; priceFcfa: number };

export function ManualPaymentPanel({
  plans,
  defaultPlan,
  manualInfo,
}: {
  plans: Plan[];
  defaultPlan: string;
  manualInfo: { tmoneyNumber: string; floozNumber: string; holderName: string; whatsappNumber: string };
}) {
  const [planCode, setPlanCode] = useState(defaultPlan);
  const formRef = useRef<HTMLDivElement>(null);
  const prevDefaultPlan = useRef(defaultPlan);
  const [operator, setOperator] = useState<"tmoney" | "flooz">("tmoney");
  const [payerPhone, setPayerPhone] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Quand on change de plan pendant qu'on est déjà sur la page (ex: clic sur « Choisir Hebdo »
  // dans les cartes, ce qui modifie ?plan= sans recharger la page), on resynchronise le
  // formulaire et on le fait défiler à la vue. Pas de défilement au premier affichage.
  useEffect(() => {
    setPlanCode(defaultPlan);
    if (prevDefaultPlan.current !== defaultPlan) {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    prevDefaultPlan.current = defaultPlan;
  }, [defaultPlan]);

  const selected = plans.find((p) => p.code === planCode) ?? plans[0];
  const floozAvailable = Boolean(manualInfo.floozNumber);
  const merchantNumber = operator === "tmoney" ? manualInfo.tmoneyNumber : manualInfo.floozNumber;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/payments/manual/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planCode, operator, payerPhone, reference, note }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erreur lors de l'envoi");
      setSuccess(true);
    } catch (err: any) {
      setError(err.message ?? "Une erreur est survenue, réessayez.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <Card className="max-w-xl text-center py-10">
        <CheckCircle2 className="w-10 h-10 text-brand-500 mx-auto mb-3" />
        <h2 className="font-bold text-white mb-2">Déclaration envoyée !</h2>
        <p className="text-sm text-white/60 mb-5">
          Notre équipe vérifie la réception de votre paiement et active votre abonnement
          manuellement, généralement sous quelques heures. Pour accélérer, envoyez-nous une
          capture d'écran de la confirmation Mobile Money sur WhatsApp.
        </p>
        <Button href={`https://wa.me/${manualInfo.whatsappNumber}`} variant="secondary">
          <MessageCircle className="w-4 h-4" /> Contacter le support WhatsApp
        </Button>
      </Card>
    );
  }

  return (
    <div ref={formRef} className="scroll-mt-24">
      <Card className="max-w-xl">
        <div className="flex items-center gap-2 mb-1">
          <Smartphone className="w-5 h-5 text-brand-500" />
          <h2 className="font-semibold text-white">Payer par Mobile Money (validation manuelle)</h2>
        </div>
        <Badge tone="accent" className="mb-4">Activation sous quelques heures, vérifiée par notre équipe</Badge>

        <ol className="space-y-2 text-sm text-white/70 mb-5 list-decimal list-inside">
          <li>Choisissez votre plan et votre opérateur ci-dessous.</li>
          <li>
            Envoyez <strong className="text-white">{formatFcfa(selected.priceFcfa)}</strong> au numéro{" "}
            <strong className="text-accent-500">{merchantNumber}</strong> ({manualInfo.holderName}) via{" "}
            {operator === "tmoney" ? "T-Money (Mixx by Yas)" : "Flooz (Moov Africa)"}.
          </li>
          <li>Remplissez le formulaire ci-dessous pour déclarer votre paiement.</li>
          <li>Votre abonnement est activé dès validation par notre équipe.</li>
        </ol>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-white/70">Plan</label>
            <select
              value={planCode}
              onChange={(e) => setPlanCode(e.target.value)}
              className="mt-1 w-full rounded-lg bg-white/5 border border-white/15 px-3 py-2 text-white text-sm"
            >
              {plans.map((p) => (
                <option key={p.code} value={p.code} className="bg-ink-800">
                  {p.name} — {formatFcfa(p.priceFcfa)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm text-white/70">Opérateur utilisé</label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <AnimatedBackground
                defaultValue={operator}
                onValueChange={(id) => {
                  if (id === "tmoney" || id === "flooz") setOperator(id);
                }}
                className="rounded-lg border border-brand-500/40 bg-brand-500/10"
                transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
              >
                <button
                  data-id="tmoney"
                  type="button"
                  className="rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold text-white/60 justify-center data-[checked=true]:text-brand-400 transition-colors"
                >
                  T-Money
                </button>
                <button
                  data-id="flooz"
                  type="button"
                  disabled={!floozAvailable}
                  className="rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold text-white/60 justify-center data-[checked=true]:text-brand-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Flooz {!floozAvailable && "(bientôt)"}
                </button>
              </AnimatedBackground>
            </div>
            {!floozAvailable && (
              <p className="text-[11px] text-white/40 mt-1">
                Flooz (Moov Africa) sera bientôt disponible. Utilisez T-Money pour l'instant.
              </p>
            )}
          </div>

          <div>
            <label className="text-sm text-white/70">Numéro depuis lequel vous avez payé</label>
            <input
              required
              type="tel"
              placeholder="90 00 00 00"
              value={payerPhone}
              onChange={(e) => setPayerPhone(e.target.value)}
              className="mt-1 w-full rounded-lg bg-white/5 border border-white/15 px-3 py-2 text-white text-sm placeholder:text-white/30"
            />
          </div>

          <div>
            <label className="text-sm text-white/70">ID de transaction (optionnel, reçu par SMS)</label>
            <input
              type="text"
              placeholder="Ex: MP240927.1234"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="mt-1 w-full rounded-lg bg-white/5 border border-white/15 px-3 py-2 text-white text-sm placeholder:text-white/30"
            />
          </div>

          <div>
            <label className="text-sm text-white/70">Message (optionnel)</label>
            <textarea
              rows={2}
              placeholder="Précision utile pour l'équipe support..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 w-full rounded-lg bg-white/5 border border-white/15 px-3 py-2 text-white text-sm placeholder:text-white/30"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <Button type="submit" disabled={loading} className="w-full" size="lg">
            {loading ? "Envoi..." : `J'ai payé ${formatFcfa(selected.priceFcfa)} — Déclarer mon paiement`}
          </Button>
          <p className="text-[11px] text-white/40 text-center">
            Besoin d'aide ? <a href={`https://wa.me/${manualInfo.whatsappNumber}`} className="underline">Contactez-nous sur WhatsApp</a>
          </p>
        </form>
      </Card>
    </div>
  );
}
