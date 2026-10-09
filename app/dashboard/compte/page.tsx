import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/BottomNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/components/SignOutButton";
import { SecurityCodeForm } from "./security-code-form";
import { FirstNameForm } from "./first-name-form";
import { PremiumCard } from "./premium-card";
import { getCurrentUserState, getFirstName } from "@/lib/subscription";

export default async function ComptePage() {
  const { userId, isPremium, planCode, subscriptionStatus, subscriptionEndsAt, fullName } =
    await getCurrentUserState();
  const firstName = getFirstName(fullName);

  // Abonnement payant actif -> carte Premium festive ; essai gratuit -> libellé dédié.
  const showPremiumCard = subscriptionStatus === "active" && !!subscriptionEndsAt;
  const statusLabel =
    subscriptionStatus === "active" ? "Premium actif" : subscriptionStatus === "trial" ? "Essai gratuit" : "Compte gratuit";

  return (
    <>
      <Navbar />
      <main className="flex-1 pb-24">
        <div className="mx-auto max-w-2xl px-4 py-8">
          <h1 className="text-2xl font-bold text-white mb-6">
            {userId && firstName ? `Bonjour ${firstName} 👋` : "Mon compte"}
          </h1>

          {!userId ? (
            <Card className="text-center py-10">
              <p className="text-white/70 mb-4">Connectez-vous pour voir votre compte et votre abonnement.</p>
              <Button href="/connexion">Se connecter</Button>
            </Card>
          ) : (
            <>
              {!fullName && <FirstNameForm />}

              {showPremiumCard && (
                <PremiumCard firstName={firstName} planCode={planCode} endsAt={subscriptionEndsAt!} />
              )}

              <Card>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between border-b border-white/10 pb-2">
                    <span className="text-white/60">Statut</span>
                    <span className="font-semibold text-white">{statusLabel}</span>
                  </div>
                  {planCode && (
                    <div className="flex justify-between border-b border-white/10 pb-2">
                      <span className="text-white/60">Plan</span>
                      <span className="font-semibold text-white capitalize">{planCode}</span>
                    </div>
                  )}
                </div>
                {!isPremium && (
                  <Button href="/dashboard/abonnement" className="w-full mt-5">
                    Passer Premium
                  </Button>
                )}
                <SecurityCodeForm />
                <SignOutButton className="w-full mt-3 border border-white/10" />
              </Card>
            </>
          )}
        </div>
      </main>
      <BottomNav />
    </>
  );
}
