"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatFcfa } from "@/lib/utils";

type PendingPayment = {
  id: string;
  amount_fcfa: number;
  payment_method: string;
  raw_payload: {
    planCode?: string;
    operator?: string;
    payerPhone?: string;
    reference?: string | null;
    note?: string | null;
  } | null;
  created_at: string;
  profiles: { phone: string | null; full_name: string | null } | null;
};

export function ManualPaymentsAdmin({ payments }: { payments: PendingPayment[] }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const router = useRouter();

  async function act(id: string, action: "approve" | "reject") {
    setBusyId(id);
    try {
      const res = await fetch(`/api/payments/manual/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId: id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      router.refresh();
    } catch (e: any) {
      alert(e.message ?? "Erreur");
    } finally {
      setBusyId(null);
    }
  }

  if (payments.length === 0) {
    return <p className="text-sm text-white/40">Aucun paiement en attente 🎉</p>;
  }

  return (
    <div className="space-y-3">
      {payments.map((p) => (
        <div key={p.id} className="rounded-lg border border-white/10 p-3 text-sm">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
            <div className="font-semibold text-white">
              {formatFcfa(p.amount_fcfa)} · {p.raw_payload?.planCode ?? "?"}
            </div>
            <Badge tone="neutral">{p.raw_payload?.operator ?? p.payment_method}</Badge>
          </div>
          <div className="text-white/60 space-y-0.5">
            <p>Client : {p.profiles?.full_name || p.profiles?.phone || "—"}</p>
            <p>Numéro payeur déclaré : {p.raw_payload?.payerPhone ?? "—"}</p>
            {p.raw_payload?.reference && <p>Référence : {p.raw_payload.reference}</p>}
            {p.raw_payload?.note && <p>Note : {p.raw_payload.note}</p>}
            <p className="text-xs text-white/40">Déclaré le {new Date(p.created_at).toLocaleString("fr-FR")}</p>
          </div>
          <div className="flex gap-2 mt-3">
            <Button size="sm" disabled={busyId === p.id} onClick={() => act(p.id, "approve")}>
              ✅ Valider
            </Button>
            <Button size="sm" variant="outline" disabled={busyId === p.id} onClick={() => act(p.id, "reject")}>
              ❌ Rejeter
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
