"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Smile } from "lucide-react";

/** Encart affiché tant que l'utilisateur n'a pas renseigné son prénom (profiles.full_name). */
export function FirstNameForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/account/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Impossible d'enregistrer ton prénom.");
      // Recharge les données serveur : la salutation et la barre de navigation se mettent à jour.
      router.refresh();
    } catch (err: any) {
      setError(err.message ?? "Une erreur est survenue, réessaie.");
      setLoading(false);
    }
  }

  return (
    <Card className="mb-6 border-accent-500/30 bg-accent-500/[0.06]">
      <div className="flex items-center gap-2 mb-1">
        <Smile className="w-5 h-5 text-accent-500" />
        <h2 className="font-semibold text-white">Comment veux-tu qu'on t'appelle ?</h2>
      </div>
      <p className="text-sm text-white/60 mb-4">Ton prénom personnalise ton espace. Tu pourras le modifier plus tard.</p>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        <input
          required
          type="text"
          autoComplete="given-name"
          maxLength={40}
          placeholder="Ton prénom"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="flex-1 rounded-lg bg-white/5 border border-white/15 px-3 py-2 text-white text-sm placeholder:text-white/30"
        />
        <Button type="submit" disabled={loading}>
          {loading ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </form>
      {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
    </Card>
  );
}
