"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const FAQ_ITEMS = [
  {
    q: "KickPredict est-il gratuit ?",
    a: "Oui : crée un compte et profite de 3 jours d'essai gratuit avec accès complet, sans carte bancaire. Ensuite, un abonnement à partir de 1 000 FCFA/semaine débloque l'accès illimité.",
  },
  {
    q: "Comment fonctionnent les prédictions de l'IA ?",
    a: "Notre moteur statistique (classement Elo + modèle de buts Poisson) analyse la forme récente des équipes, leur attaque/défense et l'historique des confrontations pour calculer une probabilité claire (victoire/nul/défaite, plus de 2,5 buts, BTTS) et un score le plus probable, expliqués en français simple.",
  },
  {
    q: "Est-ce que je peux parier directement sur KickPredict ?",
    a: "Non. KickPredict est un outil d'analyse et d'aide à la décision — nous ne sommes ni un bookmaker ni un opérateur de jeux d'argent, et nous ne prenons aucun pari. Chaque pronostic propose un raccourci vers le bookmaker de ton choix (1xBet, Betwinner, Melbet, SportyBet...) pour y placer ton pari toi-même.",
  },
  {
    q: "Les matchs et les cotes affichés sont-ils réels ?",
    a: "Oui : les matchs proviennent d'un fournisseur de données football professionnel (API-Football), synchronisés automatiquement chaque jour, avec les cotes réelles du marché quand elles sont disponibles.",
  },
  {
    q: "Comment payer mon abonnement ?",
    a: "100% Mobile Money : T-Money (Mixx by Yas) ou Flooz (Moov Africa) pour le Togo, avec d'autres opérateurs Mobile Money africains à venir. Aucune carte bancaire requise.",
  },
  {
    q: "Puis-je annuler à tout moment ?",
    a: "Oui, ton abonnement n'est jamais reconduit automatiquement sans ton accord : tu choisis la durée (hebdo, mensuel, trimestriel, annuel) et tu reviens quand tu veux.",
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="space-y-2">
      {FAQ_ITEMS.map((item, i) => {
        const isOpen = openIndex === i;
        return (
          <div
            key={item.q}
            className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden transition-colors hover:border-white/15"
          >
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : i)}
              className="w-full flex items-center justify-between gap-4 px-4 sm:px-5 py-4 text-left"
            >
              <span className="font-semibold text-white text-sm sm:text-base">{item.q}</span>
              <ChevronDown
                className={cn("w-4 h-4 text-white/50 shrink-0 transition-transform", isOpen && "rotate-180")}
              />
            </button>
            {isOpen && (
              <div className="px-4 sm:px-5 pb-4 text-sm text-white/60 leading-relaxed">{item.a}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
