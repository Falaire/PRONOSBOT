"use client";

import { useState } from "react";
import { Bookmark, BookmarkCheck, Loader2, AlertTriangle } from "lucide-react";
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
 * Traduit une erreur Supabase/Postgres en message compréhensible. Important : avant cette
 * fonction, les erreurs d'écriture (ex: table saved_picks pas encore créée si la migration
 * 0005_saved_picks.sql n'a pas été exécutée sur le projet) étaient silencieusement ignorées et
 * l'interface affichait quand même "enregistré" — c'était le bug remonté par l'utilisateur
 * (match ajouté au carnet mais introuvable ensuite, car jamais vraiment écrit en base).
 */
function friendlyError(error: { code?: string; message?: string } | null): string | null {
  if (!error) return null;
  if (error.code === "42P01") {
    return "Le carnet n'est pas encore activé sur ce site (migration base de données manquante) — contacte l'administrateur.";
  }
  if (error.code === "42501" || /row-level security/i.test(error.message ?? "")) {
    return "Connecte-toi à nouveau pour enregistrer ce match.";
  }
  return "Impossible d'enregistrer pour le moment. Réessaie dans un instant.";
}

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
  const [error, setError] = useState<string | null>(null);

  async function quickToggle() {
    if (!userId) {
      window.location.href = "/inscription";
      return;
    }
    // Import dynamique : Supabase n'est chargé qu'au clic (perf, voir SignOutButton).
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    setLoading(true);
    setError(null);
    try {
      if (saved) {
        const { error: delError } = await supabase
          .from("saved_picks")
          .delete()
          .eq("user_id", userId)
          .eq("fixture_id", fixtureId);
        if (delError) {
          console.error("saved_picks delete", delError);
          setError(friendlyError(delError));
          return; // on ne change pas l'état affiché si l'écriture a échoué
        }
        setSaved(false);
      } else {
        const { error: upsertError } = await supabase
          .from("saved_picks")
          .upsert(
            { user_id: userId, fixture_id: fixtureId, chosen_market: market || null, note: note || null },
            { onConflict: "user_id,fixture_id" }
          );
        if (upsertError) {
          console.error("saved_picks upsert", upsertError);
          setError(friendlyError(upsertError));
          return;
        }
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
    // Import dynamique : Supabase n'est chargé qu'au clic (perf, voir SignOutButton).
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    setLoading(true);
    setError(null);
    try {
      const { error: upsertError } = await supabase
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
      if (upsertError) {
        console.error("saved_picks upsert (full)", upsertError);
        setError(friendlyError(upsertError));
        return;
      }
      setSaved(true);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    } finally {
      setLoading(false);
    }
  }

  if (variant === "compact") {
    return (
      <div className="flex flex-col items-end gap-1">
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
        {error && (
          <p className="flex items-center gap-1 text-[10px] text-red-400 max-w-[180px] text-right">
            <AlertTriangle className="w-3 h-3 shrink-0" /> {error}
          </p>
        )}
      </div>
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
          {error && (
            <p className="flex items-center gap-1.5 text-xs text-red-400">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
