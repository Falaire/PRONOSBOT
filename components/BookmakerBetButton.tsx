"use client";

import { useState } from "react";
import { BOOKMAKERS, getBookmakerUrl, buildBetSlipText } from "@/lib/bookmakers";
import { Check, Copy, ExternalLink, Dices } from "lucide-react";
import type { DemoFixture } from "@/lib/demo-data";

/**
 * Honnêteté importante : aucun bookmaker (1xBet, Betwinner, Melbet, SportyBet...) n'offre
 * d'API publique permettant de créer automatiquement un coupon de pari pré-rempli. On copie
 * donc le résumé du pronostic dans le presse-papier et on ouvre le site du bookmaker choisi
 * (lien d'affiliation si configuré) : il suffit de coller/rechercher le match pour retrouver
 * le pari en 1-2 clics.
 */
export function BookmakerBetButton({
  fixture,
  variant = "compact",
}: {
  fixture: DemoFixture;
  variant?: "compact" | "full";
}) {
  const [open, setOpen] = useState(variant === "full");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function handlePick(bookmakerId: string) {
    const bookmaker = BOOKMAKERS.find((b) => b.id === bookmakerId);
    if (!bookmaker) return;
    try {
      await navigator.clipboard.writeText(buildBetSlipText(fixture));
      setCopiedId(bookmakerId);
      setTimeout(() => setCopiedId((v) => (v === bookmakerId ? null : v)), 2500);
    } catch {
      // Presse-papier indisponible (permissions navigateur) : on continue quand même vers le bookmaker.
    }
    window.open(getBookmakerUrl(bookmaker), "_blank", "noopener,noreferrer");
  }

  const grid = (
    <div className="grid grid-cols-2 gap-1.5 mt-2">
      {BOOKMAKERS.map((b) => (
        <button
          key={b.id}
          type="button"
          onClick={() => handlePick(b.id)}
          className="flex items-center justify-between gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] transition-colors px-2.5 py-1.5 text-xs font-semibold text-white"
        >
          <span className="flex items-center gap-1.5 truncate">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: b.color }} aria-hidden />
            {b.name}
          </span>
          {copiedId === b.id ? (
            <Check className="w-3.5 h-3.5 text-brand-400 shrink-0" />
          ) : (
            <ExternalLink className="w-3.5 h-3.5 text-white/40 shrink-0" />
          )}
        </button>
      ))}
    </div>
  );

  if (variant === "full") {
    return (
      <div>
        <p className="text-xs text-white/40 mb-1 flex items-center gap-1">
          <Copy className="w-3 h-3" /> Un clic copie le pronostic et ouvre le bookmaker — recherche le match là-bas
          pour placer ta mise.
        </p>
        {grid}
      </div>
    );
  }

  return (
    <div className="pt-1 border-t border-white/[0.06]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs font-semibold text-accent-500 hover:text-accent-400 mt-2"
      >
        <Dices className="w-3.5 h-3.5" /> Parier sur ce match {open ? "▲" : "▼"}
      </button>
      {open && grid}
    </div>
  );
}
