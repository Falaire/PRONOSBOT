import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/BottomNav";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfidenceBar } from "@/components/ui/confidence-bar";
import { Button } from "@/components/ui/button";
import { getFixtureById } from "@/lib/fixtures";
import { getCurrentUserState } from "@/lib/subscription";
import { formatDateTimeLome } from "@/lib/utils";
import { notFound } from "next/navigation";
import { Lock, TrendingUp } from "lucide-react";
import { BookmakerBetButton } from "@/components/BookmakerBetButton";

function marketLabel(market?: string): string {
  switch (market) {
    case "1":
      return "victoire domicile";
    case "X":
      return "match nul";
    case "2":
      return "victoire extérieur";
    case "over25":
      return "plus de 2,5 buts";
    case "btts_yes":
      return "les deux équipes marquent";
    default:
      return "marché";
  }
}

export default async function MatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fixture = await getFixtureById(id);
  if (!fixture) notFound();

  const { isPremium } = await getCurrentUserState();
  const locked = !fixture.free && !isPremium;

  return (
    <>
      <Navbar />
      <main className="flex-1 pb-24">
        <div className="mx-auto max-w-3xl px-4 py-8">
          <Badge tone="neutral">{fixture.league}</Badge>
          <h1 className="text-2xl font-bold text-white mt-2">
            {fixture.home} <span className="text-white/40">vs</span> {fixture.away}
          </h1>
          <p className="text-sm text-white/60 mb-6">{formatDateTimeLome(fixture.kickoff)}</p>

          <Card className="mb-4">
            <h2 className="font-semibold text-white mb-3">Indice de confiance IA</h2>
            <ConfidenceBar value={fixture.confidence} />
          </Card>

          {locked ? (
            <Card className="text-center py-10">
              <Lock className="w-8 h-8 text-accent-500 mx-auto mb-3" />
              <h3 className="font-semibold text-white mb-2">Analyse complète réservée aux abonnés Premium</h3>
              <p className="text-sm text-white/60 mb-5">
                Débloquez les probabilités détaillées, le score exact, les buteurs probables et l'explication complète de l'IA.
              </p>
              <Button href="/dashboard/abonnement">Débloquer pour 1 000 FCFA / semaine</Button>
            </Card>
          ) : (
            <>
              <Card className="mb-4 grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-white/50 text-xs">Victoire {fixture.home}</div>
                  <div className="text-2xl font-bold text-white">{Math.round(fixture.probHome * 100)}%</div>
                </div>
                <div>
                  <div className="text-white/50 text-xs">Match nul</div>
                  <div className="text-2xl font-bold text-white">{Math.round(fixture.probDraw * 100)}%</div>
                </div>
                <div>
                  <div className="text-white/50 text-xs">Victoire {fixture.away}</div>
                  <div className="text-2xl font-bold text-white">{Math.round(fixture.probAway * 100)}%</div>
                </div>
              </Card>

              {fixture.odds && (
                <Card className="mb-4">
                  <h3 className="font-semibold text-white mb-2">Cotes du marché (référence bookmaker)</h3>
                  <div className="grid grid-cols-3 gap-3 text-center text-sm">
                    <div className="rounded-lg bg-white/5 px-3 py-2">
                      <div className="text-white/50 text-xs">1</div>
                      <div className="font-semibold text-white">{fixture.odds.home.toFixed(2)}</div>
                    </div>
                    <div className="rounded-lg bg-white/5 px-3 py-2">
                      <div className="text-white/50 text-xs">X</div>
                      <div className="font-semibold text-white">{fixture.odds.draw.toFixed(2)}</div>
                    </div>
                    <div className="rounded-lg bg-white/5 px-3 py-2">
                      <div className="text-white/50 text-xs">2</div>
                      <div className="font-semibold text-white">{fixture.odds.away.toFixed(2)}</div>
                    </div>
                  </div>
                </Card>
              )}

              <Card className="mb-4">
                <h3 className="font-semibold text-white mb-1">Parier sur ce match</h3>
                <BookmakerBetButton fixture={fixture} variant="full" />
              </Card>

              <Card className="mb-4">
                <h3 className="font-semibold text-white mb-2">Autres marchés</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex justify-between rounded-lg bg-white/5 px-3 py-2">
                    <span className="text-white/60">Plus de 2,5 buts</span>
                    <span className="font-semibold text-white">{Math.round(fixture.probOver25 * 100)}%</span>
                  </div>
                  <div className="flex justify-between rounded-lg bg-white/5 px-3 py-2">
                    <span className="text-white/60">BTTS (oui)</span>
                    <span className="font-semibold text-white">{Math.round(fixture.probBtts * 100)}%</span>
                  </div>
                  <div className="flex justify-between rounded-lg bg-white/5 px-3 py-2 col-span-2">
                    <span className="text-white/60">Score le plus probable</span>
                    <span className="font-semibold text-white">{fixture.scoreHome} - {fixture.scoreAway}</span>
                  </div>
                </div>
              </Card>

              {fixture.isValueBet && (
                <Card className="mb-4 border-accent-500/40 bg-accent-500/5">
                  <div className="flex items-center gap-2 text-accent-500 font-semibold mb-1">
                    <TrendingUp className="w-4 h-4" /> Value bet détecté ({marketLabel(fixture.valueBetMarket)})
                  </div>
                  <p className="text-sm text-white/70">
                    La probabilité estimée par le modèle est supérieure à la probabilité du marché
                    {fixture.valueBetMarket === "1" || fixture.valueBetMarket === "X" || fixture.valueBetMarket === "2"
                      ? " (marge du bookmaker retirée)"
                      : " (cote brute, marge non retirée sur ce marché)"}
                    {typeof fixture.edgeValue === "number" ? ` : écart de +${Math.round(fixture.edgeValue * 100)} points` : ""}
                    {typeof fixture.marketProbUsed === "number" ? ` (marché estimé à ${Math.round(fixture.marketProbUsed * 100)}%)` : ""}.
                  </p>
                </Card>
              )}

              <Card>
                <h3 className="font-semibold text-white mb-2">Pourquoi l'IA a choisi ce résultat ?</h3>
                <p className="text-sm text-white/70 leading-relaxed">{fixture.explanation}</p>
                {fixture.dataGaps && fixture.dataGaps.length > 0 && (
                  <p className="text-xs text-amber-400/80 mt-3">
                    ⚠ Données non confirmées pour ce match : {fixture.dataGaps.join(", ")}. Le modèle ne les invente pas, il
                    s'appuie sur les autres signaux disponibles.
                  </p>
                )}
                <p className="text-xs text-white/40 mt-3">
                  Aucune prédiction n'est garantie : ces probabilités sont des estimations statistiques, pas une promesse
                  de résultat.
                </p>
              </Card>
            </>
          )}
        </div>
      </main>
      <BottomNav />
    </>
  );
}
