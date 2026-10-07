"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function AdminActions() {
  const [log, setLog] = useState<string[]>([]);
  const [loading, setLoading] = useState<string | null>(null);

  async function run(name: string, url: string) {
    setLoading(name);
    try {
      const res = await fetch(url, { method: "POST" });
      const json = await res.json();
      setLog((l) => [`[${new Date().toLocaleTimeString()}] ${name}: ${JSON.stringify(json)}`, ...l]);
    } catch (e: any) {
      setLog((l) => [`[${new Date().toLocaleTimeString()}] ${name} ERREUR: ${e.message}`, ...l]);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4">
        <Button
          size="sm"
          disabled={loading !== null}
          onClick={() => run("Synchro matchs", "/api/predictions/sync-fixtures")}
        >
          Synchroniser les matchs
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={loading !== null}
          onClick={() => run("Mettre à jour les ratings", "/api/predictions/update-ratings")}
        >
          Mettre à jour les ratings (matchs terminés)
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={loading !== null}
          onClick={() => run("Générer pronostics", "/api/predictions/generate")}
        >
          Générer les pronostics
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={loading !== null}
          onClick={() => run("Notifier Telegram", "/api/notify/telegram")}
        >
          Envoyer les alertes Telegram
        </Button>
      </div>
      <div className="rounded-lg bg-black/30 p-3 text-xs font-mono text-white/60 max-h-64 overflow-auto space-y-1">
        {log.length === 0 ? <p>Aucune action lancée.</p> : log.map((l, i) => <p key={i}>{l}</p>)}
      </div>
    </div>
  );
}
