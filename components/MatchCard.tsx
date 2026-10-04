import { Badge } from "@/components/ui/badge";
import { ConfidenceBar } from "@/components/ui/confidence-bar";
import { Card } from "@/components/ui/card";
import { formatDateTimeLome } from "@/lib/utils";
import { Lock, TrendingUp } from "lucide-react";
import Link from "next/link";
import type { DemoFixture } from "@/lib/demo-data";

export function MatchCard({ fixture, locked }: { fixture: DemoFixture; locked: boolean }) {
  return (
    <Card variant="glow" className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Badge tone="neutral">{fixture.league}</Badge>
        <span className="text-xs text-white/45">{formatDateTimeLome(fixture.kickoff)}</span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold text-white flex-1 text-right">{fixture.home}</div>
        <div className="text-white/30 text-[10px] px-2 font-semibold tracking-wider">VS</div>
        <div className="text-sm font-semibold text-white flex-1">{fixture.away}</div>
      </div>

      {locked ? (
        <div className="relative">
          <div className="blur-sm select-none pointer-events-none">
            <ConfidenceBar value={fixture.confidence} />
            <p className="text-xs text-white/60 mt-2 line-clamp-2">{fixture.explanation}</p>
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ink-950/75 backdrop-blur-sm rounded-lg">
            <Lock className="w-5 h-5 text-accent-500" />
            <Link href="/dashboard/abonnement" className="text-xs font-semibold text-accent-500 underline">
              Débloquer avec Premium
            </Link>
          </div>
        </div>
      ) : (
        <>
          <ConfidenceBar value={fixture.confidence} />
          <div className="flex items-center gap-2 flex-wrap">
            <Badge tone="brand">{fixture.prediction}</Badge>
            <Badge tone="neutral">Score probable {fixture.scoreHome}-{fixture.scoreAway}</Badge>
            {fixture.isValueBet && (
              <Badge tone="accent" className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> Value bet
              </Badge>
            )}
          </div>
          <p className="text-xs text-white/60">{fixture.explanation}</p>
          <div className="grid grid-cols-3 gap-2 text-center text-xs mt-1">
            <div className="rounded-lg bg-white/[0.04] border border-white/[0.06] py-2">
              <div className="text-white/40">1{fixture.odds ? ` · ${fixture.odds.home.toFixed(2)}` : ""}</div>
              <div className="font-semibold text-white">{Math.round(fixture.probHome * 100)}%</div>
            </div>
            <div className="rounded-lg bg-white/[0.04] border border-white/[0.06] py-2">
              <div className="text-white/40">X{fixture.odds ? ` · ${fixture.odds.draw.toFixed(2)}` : ""}</div>
              <div className="font-semibold text-white">{Math.round(fixture.probDraw * 100)}%</div>
            </div>
            <div className="rounded-lg bg-white/[0.04] border border-white/[0.06] py-2">
              <div className="text-white/40">2{fixture.odds ? ` · ${fixture.odds.away.toFixed(2)}` : ""}</div>
              <div className="font-semibold text-white">{Math.round(fixture.probAway * 100)}%</div>
            </div>
          </div>
          {fixture.odds && (
            <p className="text-[10px] text-white/35">Cotes du marché (référence bookmaker) à titre indicatif.</p>
          )}
          <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-white/[0.06]">
            <Badge tone="neutral" className="text-[11px]">
              +2,5 buts {Math.round(fixture.probOver25 * 100)}%
            </Badge>
            <Badge tone="neutral" className="text-[11px]">
              BTTS {Math.round(fixture.probBtts * 100)}%
            </Badge>
          </div>
        </>
      )}

      <Link
        href={`/dashboard/match/${fixture.id}`}
        className="text-xs text-brand-400 font-semibold hover:underline mt-1"
      >
        Voir l'analyse complète →
      </Link>
    </Card>
  );
}
