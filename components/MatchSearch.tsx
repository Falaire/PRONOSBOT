"use client";

import { useMemo, useState } from "react";
import { Search, SearchX } from "lucide-react";
import { MatchCard } from "@/components/MatchCard";
import type { DemoFixture } from "@/lib/demo-data";
import { MANUAL_PAYMENT_INFO } from "@/lib/payments/config";

/** Enlève les accents pour une recherche plus tolérante ("cote d ivoire" trouve "Côte d'Ivoire"). */
function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Barre de recherche client-side sur les matchs déjà chargés (équipe ou championnat). Les
 * matchs affichés sont ceux synchronisés pour les prochaines 48h (voir lib/fixtures.ts) — si
 * l'utilisateur cherche un match plus lointain qui n'est pas encore dans cette fenêtre, on
 * l'invite à nous le signaler plutôt que d'afficher un faux résultat vide sans explication.
 */
export function MatchSearch({
  fixtures,
  isPremium,
  userId = null,
  savedFixtureIds = [],
}: {
  fixtures: DemoFixture[];
  isPremium: boolean;
  userId?: string | null;
  savedFixtureIds?: string[];
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return fixtures;
    return fixtures.filter((f) => normalize(`${f.home} ${f.away} ${f.league}`).includes(q));
  }, [fixtures, query]);

  const savedSet = useMemo(() => new Set(savedFixtureIds), [savedFixtureIds]);

  return (
    <div>
      <div className="relative mb-6">
        <Search className="w-4 h-4 text-white/35 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher une équipe ou un championnat (ex: Sénégal, Real Madrid, CAN...)"
          className="w-full rounded-xl bg-white/5 border border-white/15 pl-10 pr-3 py-2.5 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-10 text-center">
          <SearchX className="w-8 h-8 text-white/25 mx-auto mb-3" />
          <p className="text-white/70 font-semibold mb-1">Aucun match trouvé pour « {query} »</p>
          <p className="text-sm text-white/50 max-w-sm mx-auto">
            On ne couvre peut-être pas encore ce championnat, ou ce match est prévu dans plus de 48h. Dis-le-nous sur
            WhatsApp et on regarde pour l&apos;ajouter.
          </p>
          <a
            href={`https://wa.me/${MANUAL_PAYMENT_INFO.whatsappNumber}?text=${encodeURIComponent(
              `Salut ! Je cherche ce match : ${query}`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-4 text-sm font-semibold text-accent-500 hover:underline"
          >
            Demander ce match sur WhatsApp →
          </a>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((f) => (
            <MatchCard
              key={f.id}
              fixture={f}
              locked={!f.free && !isPremium}
              userId={userId}
              saved={savedSet.has(f.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
