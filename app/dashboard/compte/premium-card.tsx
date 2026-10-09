import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

const PLAN_LABELS: Record<string, string> = {
  hebdo: "Hebdo",
  mensuel: "Mensuel",
  trimestriel: "Trimestriel",
  annuel: "Annuel",
};

/** Jours restants avant la fin de l'abonnement (arrondi au jour entamé, minimum 0). */
export function daysLeft(endsAtIso: string, now = new Date()): number {
  const ms = new Date(endsAtIso).getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / (24 * 3600 * 1000)));
}

/** Carte festive pour les abonnés Premium actifs (remplace le simple libellé « Premium actif »). */
export function PremiumCard({
  firstName,
  planCode,
  endsAt,
}: {
  firstName: string | null;
  planCode: string | null;
  endsAt: string;
}) {
  const days = daysLeft(endsAt);
  const planLabel = planCode ? (PLAN_LABELS[planCode] ?? planCode) : null;

  return (
    <Card className="mb-6 relative overflow-hidden border-accent-500/40 ring-1 ring-accent-500/30 bg-gradient-to-br from-accent-500/[0.12] via-brand-500/[0.06] to-transparent">
      <div className="flex items-start gap-3">
        <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-accent-500/15 border border-accent-500/30 shrink-0">
          <Sparkles className="w-5 h-5 text-accent-500" />
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-white text-lg">
            Merci{firstName ? ` ${firstName}` : ""}, tu es Premium ✨
          </h2>
          <p className="text-sm text-white/70 mt-1">
            {planLabel && <>Plan <span className="font-semibold text-white">{planLabel}</span> · </>}
            {days > 0 ? (
              <>
                encore <span className="font-semibold text-accent-500">{days} jour{days > 1 ? "s" : ""}</span> d'accès
              </>
            ) : (
              "ton accès se termine aujourd'hui"
            )}
          </p>
          <p className="text-[11px] text-white/45 mt-0.5">
            Valable jusqu'au {new Date(endsAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
      </div>
      <Button href="/dashboard/abonnement" variant="secondary" className="w-full mt-4">
        Renouveler / changer de plan
      </Button>
    </Card>
  );
}
