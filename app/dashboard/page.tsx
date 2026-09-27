import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/BottomNav";
import { MatchCard } from "@/components/MatchCard";
import { Badge } from "@/components/ui/badge";
import { DEMO_FIXTURES } from "@/lib/demo-data";
import { getCurrentUserState, getFreeLimit } from "@/lib/subscription";
import { Sparkles } from "lucide-react";

export default async function DashboardPage() {
  const { isPremium, trialEndsAt } = await getCurrentUserState();
  const freeLimit = getFreeLimit();

  // TODO: remplacer DEMO_FIXTURES par un fetch Supabase réel :
  // select * from fixtures join predictions ... where kickoff_at::date = today order by league priority
  const fixtures = DEMO_FIXTURES;

  const visibleFree = fixtures.filter((f) => f.free);
  const visiblePremium = fixtures.filter((f) => !f.free);

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

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleFree.map((f) => (
              <MatchCard key={f.id} fixture={f} locked={false} />
            ))}
            {visiblePremium.map((f) => (
              <MatchCard key={f.id} fixture={f} locked={!isPremium} />
            ))}
          </div>
        </div>
      </main>
      <BottomNav />
    </>
  );
}
