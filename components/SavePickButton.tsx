"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Bookmark, BookmarkCheck, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const MARKET_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Pas de marché précis (je suis juste le match)" },
  { value: "1", label: "Victoire domicile (1)" },
  { value: "X", label: "Match nul (X)" },
  { value: "2", label: "Victoire extérieur (2)" },
  { value: "over25", label: "Plus de 2,5 buts" },
  { value: "btts_yes", label: "Les deux équipes marquent" },
];

/**
 * Bouton "carnet" : permet d'enregistrer un match dans le carnet personnel de l'utilisateur
 * (table saved_picks, RLS : chacun ne voit/modifie que les siens). Variante "compact" pour les
 * cartes de la liste (un clic = enregistré, sans marché précis) ; variante "full" pour la page
 * de détail du match (choix du marché + note libre).
 */
export function SavePickButton({
  fixtureId,
  userId,
  initiallySaved,
  initialMarket = null,
  initialNote = null,
  variant = "compact",
}: {
  fixtureId: string;
  userId: string | null;
  initiallySaved: boolean;
  initialMarket?: string | null;
  initialNote?: string | null;
  variant?: "compact" | "full";
}) {
  const [saved, setSaved] = useState(initiallySaved);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [market, setMarket] = useState(initialMarket ?? "");
  const [note, setNote] = useState(initialNote ?? "");
  const [justSaved, setJustSaved] = useState(false);

  async function quickToggle() {
    if (!userId) {
      window.location.href = "/inscription";
      return;
    }
    const supabase = createClient();
    setLoading(true);
    try {
      if (saved) {
        await supabase.from("saved_picks").delete().eq("user_id", userId).eq("fixture_id", fixtureId);
        setSaved(false);
      } else {
        await supabase
          .from("saved_picks")
          .upsert(
            { user_id: userId, fixture_id: fixtureId, chosen_market: market || null, note: note || null },
            { onConflict: "user_id,fixture_id" }
          );
        setSaved(true);
      }
    } finally {
      setLoading(false);
    }
  }

  async function saveDetails() {
    if (!userId) {
      window.location.href = "/inscription";
      return;
    }
    const supabase = createClient();
    setLoading(true);
    try {
      await supabase
        .from("saved_picks")
        .upsert(
          {
            user_id: userId,
            fixture_id: fixtureId,
            chosen_market: market || null,
            note: note || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,fixture_id" }
        );
      setSaved(true);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    } finally {
      setLoading(false);
    }
  }

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={quickToggle}
        disabled={loading}
        title={saved ? "Retirer du carnet" : "Ajouter à mon carnet"}
        className={cn(
          "flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-semibold transition-colors shrink-0",
          saved
            ? "border-brand-500/40 bg-brand-500/10 text-brand-400"
            : "border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.08]"
        )}
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : saved ? (
          <BookmarkCheck className="w-3.5 h-3.5" />
        ) : (
          <Bookmark className="w-3.5 h-3.5" />
        )}
        {saved ? "Dans mon carnet" : "Carnet"}
      </button>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs font-semibold text-accent-500 hover:text-accent-400"
      >
        {saved ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
        {saved ? "Dans mon carnet" : "Ajouter à mon carnet"} {open ? "▲" : "▼"}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <select
            value={market}
            onChange={(e) => setMarket(e.target.value)}
            className="w-full rounded-lg bg-white/5 border border-white/15 px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-brand-500/40"
          >
            {MARKET_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-ink-950">
                {opt.label}
              </option>
            ))}
          </select>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note personnelle (optionnel) : pourquoi ce choix, montant prévu..."
            rows={2}
            className="w-full rounded-lg bg-white/5 border border-white/15 px-3 py-2 text-xs text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
          />
          <button
            type="button"
            onClick={saveDetails}
            disabled={loading}
            className="w-full rounded-lg bg-brand-500 hover:bg-brand-400 transition-colors text-ink-950 text-xs font-bold py-2"
          >
            {loading ? "Enregistrement..." : justSaved ? "✓ Enregistré" : "Enregistrer dans mon carnet"}
          </button>
        </div>
      )}
    </div>
  );
}
