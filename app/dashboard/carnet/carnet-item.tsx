"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookmakerBetButton } from "@/components/BookmakerBetButton";
import { formatDateTimeLome } from "@/lib/utils";
import { Trash2, Check, X as XIcon } from "lucide-react";
import Link from "next/link";
import type { SavedPick } from "@/lib/saved-picks";

const MARKET_LABELS: Record<string, string> = {
  "1": "Victoire domicile",
  X: "Match nul",
  "2": "Victoire extérieur",
  over25: "Plus de 2,5 buts",
  btts_yes: "BTTS (oui)",
};

const STATUS_OPTIONS: { value: SavedPick["status"]; label: string; tone: "brand" | "accent" | "neutral" }[] = [
  { value: "pending", label: "En attente", tone: "neutral" },
  { value: "won", label: "Gagné", tone: "brand" },
  { value: "lost", label: "Perdu", tone: "accent" },
  { value: "void", label: "Annulé", tone: "neutral" },
];

export function CarnetItem({ pick }: { pick: SavedPick }) {
  const [note, setNote] = useState(pick.note ?? "");
  const [status, setStatus] = useState(pick.status);
  const [removed, setRemoved] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const [loading, setLoading] = useState(false);

  async function remove() {
    const supabase = createClient();
    setLoading(true);
    try {
      await supabase.from("saved_picks").delete().eq("id", pick.id);
      setRemoved(true);
    } finally {
      setLoading(false);
    }
  }

  async function saveNote() {
    const supabase = createClient();
    setLoading(true);
    try {
      await supabase.from("saved_picks").update({ note, updated_at: new Date().toISOString() }).eq("id", pick.id);
      setEditingNote(false);
    } finally {
      setLoading(false);
    }
  }

  async function changeStatus(next: SavedPick["status"]) {
    const supabase = createClient();
    setStatus(next);
    await supabase.from("saved_picks").update({ status: next, updated_at: new Date().toISOString() }).eq("id", pick.id);
  }

  if (removed) return null;

  const isPast = new Date(pick.kickoff).getTime() < Date.now();
  const betSlipFixture = {
    home: pick.home,
    away: pick.away,
    league: pick.league,
    kickoff: pick.kickoff,
    prediction: pick.predictionLabel ?? "Analyse en cours",
    confidence: pick.confidence ?? 50,
    odds:
      pick.oddsHome && pick.oddsDraw && pick.oddsAway
        ? { home: pick.oddsHome, draw: pick.oddsDraw, away: pick.oddsAway }
        : undefined,
  };

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Badge tone="neutral">{pick.league}</Badge>
          <h3 className="text-sm font-semibold text-white mt-1.5">
            {pick.home} <span className="text-white/40">vs</span> {pick.away}
          </h3>
          <p className="text-xs text-white/45">{formatDateTimeLome(pick.kickoff)}</p>
        </div>
        <button
          type="button"
          onClick={remove}
          disabled={loading}
          title="Retirer du carnet"
          className="text-white/30 hover:text-red-400 transition-colors shrink-0"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {pick.chosenMarket && <Badge tone="brand">{MARKET_LABELS[pick.chosenMarket] ?? pick.chosenMarket}</Badge>}
        {pick.predictionLabel && <Badge tone="neutral">Modèle : {pick.predictionLabel}</Badge>}
        {typeof pick.confidence === "number" && <Badge tone="neutral">{pick.confidence}% confiance</Badge>}
      </div>

      {editingNote ? (
        <div className="space-y-1.5">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="w-full rounded-lg bg-white/5 border border-white/15 px-3 py-2 text-xs text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={saveNote}
              disabled={loading}
              className="flex items-center gap-1 text-xs font-semibold text-brand-400 hover:text-brand-300"
            >
              <Check className="w-3.5 h-3.5" /> Enregistrer
            </button>
            <button
              type="button"
              onClick={() => {
                setNote(pick.note ?? "");
                setEditingNote(false);
              }}
              className="flex items-center gap-1 text-xs font-semibold text-white/50 hover:text-white"
            >
              <XIcon className="w-3.5 h-3.5" /> Annuler
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setEditingNote(true)} className="text-left">
          <p className="text-xs text-white/60 italic">{note ? `"${note}"` : "Ajouter une note personnelle..."}</p>
        </button>
      )}

      {isPast ? (
        <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-white/[0.06]">
          <span className="text-xs text-white/40 mr-1">Résultat :</span>
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => changeStatus(opt.value)}
              className={`text-[11px] font-semibold rounded-full px-2.5 py-1 border transition-colors ${
                status === opt.value
                  ? "border-brand-500/50 bg-brand-500/15 text-brand-400"
                  : "border-white/10 bg-white/[0.03] text-white/50 hover:bg-white/[0.08]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="pt-1 border-t border-white/[0.06]">
          <BookmakerBetButton fixture={betSlipFixture} variant="full" />
        </div>
      )}

      <Link href={`/dashboard/match/${pick.fixtureId}`} className="text-xs text-brand-400 font-semibold hover:underline">
        Voir l'analyse complète →
      </Link>
    </Card>
  );
}
