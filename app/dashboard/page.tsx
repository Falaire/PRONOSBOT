import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/BottomNav";
import { MatchSearch } from "@/components/MatchSearch";
import { Badge } from "@/components/ui/badge";
import { getTodayFixtures } from "@/lib/fixtures";
import { getSavedFixtureIds } from "@/lib/saved-picks";
import { getCurrentUserState, getFreeLimit } from "@/lib/subscription";
import { Sparkles } from "lucide-react";

export default async function DashboardPage() {
  const { userId, isPremium, trialEndsAt } = await getCurrentUserState();
  const freeLimit = getFreeLimit();

  // Vrais matchs synchronisés depuis API-Football (avec repli sur des exemples de démo
  // tant qu'aucune synchronisation n'a encore été effectuée depuis /admin).
  const [fixtures, savedFixtureIds] = await Promise.all([getTodayFixtures(), getSavedFixtureIds(userId)]);

  return (
    <>
      <Navbar />
      <main className="flex-1 pb-24">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white">Pronostics du jour</h1>
              <p className="text-sm text-white/60">Mis à jour automatiquement chaque matin (heure de Lomé).</p>
            </div>
            {isPremium ? (
              <Badge tone="brand" className="flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Compte Premium actif
              </Badge>
            ) : (
              <Badge tone="neutral">Compte gratuit — {freeLimit} matchs/jour</Badge>
            )}
          </div>

          {trialEndsAt && (
            <div className="mb-6 rounded-xl border border-accent-500/30 bg-accent-500/10 px-4 py-3 text-sm text-accent-500">
              Votre essai gratuit se termine le {new Date(trialEndsAt).toLocaleDateString("fr-FR")}.
            </div>
          )}

          <MatchSearch fixtures={fixtures} isPremium={isPremium} userId={userId} savedFixtureIds={savedFixtureIds} />
        </div>
      </main>
      <BottomNav />
    </>
  );
}
