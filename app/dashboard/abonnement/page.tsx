import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/BottomNav";
import { PricingCard } from "@/components/PricingCard";
import { PaymentPanel } from "./payment-panel";
import { ManualPaymentPanel } from "./manual-payment-panel";
import { getPaymentsProvider, MANUAL_PAYMENT_INFO } from "@/lib/payments/config";
import { getCurrentUserState } from "@/lib/subscription";

const PLANS = [
  { code: "hebdo", name: "Hebdo", priceFcfa: 1000, durationDays: 7, features: ["Accès illimité 7 jours", "Alertes Telegram", "Idéal pour tester"] },
  { code: "mensuel", name: "Mensuel", priceFcfa: 3000, durationDays: 30, highlighted: true, features: ["Accès illimité", "Analyses détaillées + explications", "Alertes WhatsApp/Telegram", "Mode Value Bet"] },
  { code: "trimestriel", name: "Trimestriel", priceFcfa: 7500, durationDays: 90, perMonthFcfa: 2500, features: ["Tout Mensuel", "-17% vs mensuel", "Support prioritaire"] },
  { code: "annuel", name: "Annuel", priceFcfa: 25000, durationDays: 365, perMonthFcfa: 2083, features: ["Tout Trimestriel", "-30% vs mensuel", "2 mois offerts"] },
];

export default async function AbonnementPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; status?: string }>;
}) {
  const params = await searchParams;
  const provider = getPaymentsProvider();
  const { planCode: currentPlanCode } = await getCurrentUserState();

  // Plan affiché par défaut dans le formulaire : celui de l'URL (?plan=) s'il est valide,
  // sinon le plan actuel de l'utilisateur (renouvellement), sinon "mensuel".
  const isKnownPlan = (code: string | null | undefined): code is string =>
    !!code && PLANS.some((p) => p.code === code);
  const defaultPlan = isKnownPlan(params.plan)
    ? params.plan
    : isKnownPlan(currentPlanCode)
      ? currentPlanCode
      : "mensuel";

  return (
    <>
      <Navbar />
      <main className="flex-1 pb-24">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <h1 className="text-2xl font-bold text-white mb-1">Choisissez votre abonnement</h1>
          <p className="text-sm text-white/60 mb-6">
            Paiement 100% Mobile Money — T-Money (Mixx by Yas) ou Flooz (Moov Africa). Aucune carte bancaire requise.
          </p>

          {params.status === "retour" && (
            <div className="mb-6 rounded-xl border border-brand-500/30 bg-brand-500/10 px-4 py-3 text-sm text-brand-400">
              Paiement en cours de vérification... Votre abonnement s'active automatiquement dès confirmation de
              l'opérateur (quelques secondes en général).
            </div>
          )}

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {PLANS.map((p) => (
              <PricingCard key={p.code} plan={p} currentPlanCode={currentPlanCode} />
            ))}
          </div>

          {provider === "manual" ? (
            <ManualPaymentPanel plans={PLANS} defaultPlan={defaultPlan} manualInfo={MANUAL_PAYMENT_INFO} />
          ) : (
            <PaymentPanel plans={PLANS} defaultPlan={defaultPlan} />
          )}
        </div>
      </main>
      <BottomNav />
    </>
  );
}
