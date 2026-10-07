import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/BottomNav";
import { Card } from "@/components/ui/card";
import { DEMO_ACCURACY } from "@/lib/demo-data";

export default function HistoriquePage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 pb-24">
        <div className="mx-auto max-w-4xl px-4 py-8">
          <h1 className="text-2xl font-bold text-white mb-1">Historique de précision de l'IA</h1>
          <p className="text-sm text-white/60 mb-6">
            Transparence totale : nous publions la performance réelle de notre modèle, calculée automatiquement après
            chaque match.
          </p>

          <div className="grid sm:grid-cols-3 gap-4 mb-8">
            <Card className="text-center" variant="glow">
              <div className="text-4xl font-extrabold font-display bg-gradient-to-r from-brand-400 to-accent-500 bg-clip-text text-transparent">
                {Math.round(DEMO_ACCURACY.last30Days * 100)}%
              </div>
              <div className="text-sm text-white/55 mt-1.5">Précision 1X2 (30 derniers jours)</div>
            </Card>
            <Card className="text-center" variant="glow">
              <div className="text-4xl font-extrabold font-display text-white">{DEMO_ACCURACY.totalPredictions}</div>
              <div className="text-sm text-white/55 mt-1.5">Pronostics analysés</div>
            </Card>
            <Card className="text-center" variant="glow">
              <div className="text-4xl font-extrabold font-display text-white">{DEMO_ACCURACY.correct1x2}</div>
              <div className="text-sm text-white/55 mt-1.5">Résultats corrects</div>
            </Card>
          </div>

          <Card>
            <p className="text-sm text-white/60 leading-relaxed">
              Méthodologie : chaque pronostic (1X2) est comparé automatiquement au résultat final du match une fois
              celui-ci terminé. Le taux ci-dessus couvre tous les matchs analysés par le modèle Elo + Poisson, toutes
              ligues confondues. Les performances passées ne garantissent pas les résultats futurs — jouez de manière
              responsable.
            </p>
          </Card>
        </div>
      </main>
      <BottomNav />
    </>
  );
}
