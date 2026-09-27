import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatFcfa } from "@/lib/utils";
import { Check } from "lucide-react";

export type PricingPlan = {
  code: string;
  name: string;
  priceFcfa: number;
  durationDays: number;
  features: string[];
  highlighted?: boolean;
  perMonthFcfa?: number;
};

export function PricingCard({ plan }: { plan: PricingPlan }) {
  return (
    <Card className={plan.highlighted ? "border-accent-500/50 ring-1 ring-accent-500/40 relative" : "relative"}>
      {plan.highlighted && (
        <Badge tone="accent" className="absolute -top-3 left-1/2 -translate-x-1/2">Le plus populaire</Badge>
      )}
      <h3 className="text-lg font-bold text-white">{plan.name}</h3>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-3xl font-extrabold text-white">{formatFcfa(plan.priceFcfa)}</span>
      </div>
      {plan.perMonthFcfa && (
        <p className="text-xs text-white/50 mt-1">soit {formatFcfa(plan.perMonthFcfa)} / mois</p>
      )}
      <ul className="mt-4 space-y-2">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-white/80">
            <Check className="w-4 h-4 text-brand-500 mt-0.5 shrink-0" />
            {f}
          </li>
        ))}
      </ul>
      <Button
        href={`/dashboard/abonnement?plan=${plan.code}`}
        variant={plan.highlighted ? "secondary" : "primary"}
        className="w-full mt-5"
      >
        Choisir {plan.name}
      </Button>
      <p className="text-[11px] text-white/40 mt-2 text-center">Paiement T-Money / Flooz, sans carte bancaire</p>
    </Card>
  );
}
