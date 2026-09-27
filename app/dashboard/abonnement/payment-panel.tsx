"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatFcfa } from "@/lib/utils";
import { Smartphone } from "lucide-react";

type Plan = { code: string; name: string; priceFcfa: number };

export function PaymentPanel({ plans, defaultPlan }: { plans: Plan[]; defaultPlan: string }) {
  const [planCode, setPlanCode] = useState(defaultPlan);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = plans.find((p) => p.code === planCode) ?? plans[0];

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/payments/cinetpay/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planCode, phone }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erreur de paiement");
      window.location.href = json.paymentUrl;
    } catch (err: any) {
      setError(err.message ?? "Une erreur est survenue, réessayez.");
      setLoading(false);
    }
  }

  return (
    <Card className="max-w-xl">
      <div className="flex items-center gap-2 mb-4">
        <Smartphone className="w-5 h-5 text-brand-500" />
        <h2 className="font-semibold text-white">Payer avec Mobile Money</h2>
      </div>
      <form onSubmit={handlePay} className="space-y-4">
        <div>
          <label className="text-sm text-white/70">Plan sélectionné</label>
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
          <label className="text-sm text-white/70">Numéro Mobile Money (T-Money ou Flooz)</label>
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
        <Button type="submit" disabled={loading} className="w-full" size="lg">
          {loading ? "Redirection en cours..." : `Payer ${formatFcfa(selected.priceFcfa)}`}
        </Button>
        <p className="text-[11px] text-white/40 text-center">
          Vous allez recevoir une demande de confirmation sur votre téléphone (code USSD ou notification). Votre abonnement
          s'active automatiquement après confirmation.
        </p>
      </form>
    </Card>
  );
}
