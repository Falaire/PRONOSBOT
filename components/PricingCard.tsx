import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatFcfa } from "@/lib/utils";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { BorderTrail } from "@/components/motion/border-trail";

export type PricingPlan = {
  code: string;
  name: string;
  priceFcfa: number;
  durationDays: number;
  features: string[];
  highlighted?: boolean;
  perMonthFcfa?: number;
};

/**
 * Carte d'un plan. Si `currentPlanCode` correspond à ce plan (abonnement actif de l'utilisateur
 * connecté), la carte est mise en avant (halo, badge « Ton plan actuel », bouton « Renouveler »),
 * ce qui remplace le badge générique « Le plus populaire ».
 */
export function PricingCard({ plan, currentPlanCode = null }: { plan: PricingPlan; currentPlanCode?: string | null }) {
  const isCurrent = !!currentPlanCode && plan.code === currentPlanCode;

  return (
    <Card
      className={cn(
        "relative flex flex-col",
        isCurrent
          ? "border-brand-500/60 ring-2 ring-brand-500/50 shadow-glow bg-gradient-to-b from-brand-500/[0.10] to-transparent"
          : plan.highlighted &&
              "border-accent-500/40 ring-1 ring-accent-500/30 bg-gradient-to-b from-accent-500/[0.06] to-transparent"
      )}
    >
      {(isCurrent || plan.highlighted) && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]" aria-hidden>
          <BorderTrail
            size={isCurrent ? 72 : 56}
            className={isCurrent ? "bg-brand-400 shadow-glow" : "bg-accent-400 shadow-glow-accent"}
          />
        </div>
      )}
      {isCurrent ? (
        <Badge tone="brand" className="absolute -top-3 left-1/2 -translate-x-1/2 shadow-glow">
          ✓ Ton plan actuel
        </Badge>
      ) : (
        plan.highlighted && (
          <Badge tone="accent" className="absolute -top-3 left-1/2 -translate-x-1/2 shadow-glow-accent">
            Le plus populaire
          </Badge>
        )
      )}
      <h3 className="text-lg font-bold text-white">{plan.name}</h3>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-3xl font-extrabold font-display text-white">{formatFcfa(plan.priceFcfa)}</span>
      </div>
      {plan.perMonthFcfa && (
        <p className="text-xs text-white/45 mt-1">soit {formatFcfa(plan.perMonthFcfa)} / mois</p>
      )}
      <ul className="mt-4 space-y-2.5 flex-1">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-white/75">
            <Check className="w-4 h-4 text-brand-500 mt-0.5 shrink-0" />
            {f}
          </li>
        ))}
      </ul>
      <Button
        href={`/dashboard/abonnement?plan=${plan.code}`}
        variant={plan.highlighted && !isCurrent ? "secondary" : "primary"}
        className="w-full mt-5"
      >
        {isCurrent ? "Renouveler" : `Choisir ${plan.name}`}
      </Button>
      <p className="text-[11px] text-white/35 mt-2 text-center">Paiement T-Money / Flooz, sans carte bancaire</p>
    </Card>
  );
}
