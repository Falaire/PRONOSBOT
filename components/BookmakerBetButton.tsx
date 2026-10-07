"use client";

import { useState } from "react";
import { BOOKMAKERS, getBookmakerDeepLink, buildBetSlipText, type BetSlipInfo } from "@/lib/bookmakers";
import { Check, Copy, ExternalLink, Dices } from "lucide-react";

/**
 * Honnêteté importante : aucun bookmaker (1xBet, Betwinner, Melbet, SportyBet...) n'offre
 * d'API publique permettant de créer automatiquement un coupon de pari pré-rempli — ça
 * demanderait un partenariat officiel qu'on n'a pas. On fait donc le maximum possible sans ça :
 *   1. on copie le résumé du pronostic (match, marché, cote) dans le presse-papier,
 *   2. sur Android, si on connaît le paquet de l'app du bookmaker, on l'ouvre DIRECTEMENT si
 *      elle est déjà installée (sinon on retombe automatiquement sur le site, voir
 *      lib/bookmakers.ts::getBookmakerDeepLink) ; sur iOS/desktop on ouvre le site (lien
 *      d'affiliation si configuré) — iOS ouvre déjà l'app toute seule si son éditeur a configuré
 *      les Universal Links pour son domaine, indépendamment de notre code.
 *   3. il suffit de coller/rechercher le match une fois dans l'app ou sur le site pour
 *      retrouver le pari exact.
 */
export function BookmakerBetButton({
  fixture,
  variant = "compact",
}: {
  fixture: BetSlipInfo;
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
    const deepLink = getBookmakerDeepLink(bookmaker);
    if (deepLink.startsWith("intent://")) {
      // Les liens intent:// (Android) doivent être chargés dans l'onglet courant pour que
      // Chrome les intercepte et bascule vers l'app installée (ou le site en repli sinon).
      window.location.href = deepLink;
    } else {
      window.open(deepLink, "_blank", "noopener,noreferrer");
    }
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
