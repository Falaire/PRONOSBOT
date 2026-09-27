import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AdminActions } from "./admin-actions";
import { ManualPaymentsAdmin } from "./manual-payments-admin";

export default async function AdminPage() {
  let isAdmin = false;
  let pendingPayments: any[] = [];

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      isAdmin = profile?.role === "admin";
    }

    if (isAdmin) {
      const { data } = await supabase
        .from("payments")
        .select("id, amount_fcfa, payment_method, raw_payload, created_at, profiles(phone, full_name)")
        .eq("provider", "manual")
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      pendingPayments = data ?? [];
    }
  } catch {
    isAdmin = false;
  }

  if (!isAdmin) redirect("/dashboard");

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-8">
          <h1 className="text-2xl font-bold text-white mb-6">Panneau d'administration</h1>

          <Card className="mb-4">
            <h2 className="font-semibold text-white mb-2">
              Paiements manuels en attente ({pendingPayments.length})
            </h2>
            <p className="text-sm text-white/60 mb-4">
              Vérifiez la réception du dépôt Mobile Money (SMS reçu sur le numéro marchand) avant de valider.
            </p>
            <ManualPaymentsAdmin payments={pendingPayments} />
          </Card>

          <Card className="mb-4">
            <h2 className="font-semibold text-white mb-2">Pipeline de données</h2>
            <p className="text-sm text-white/60 mb-4">
              Ces actions sont normalement déclenchées automatiquement par les tâches planifiées (crons Vercel), mais
              peuvent être forcées manuellement ici.
            </p>
            <AdminActions />
          </Card>
        </div>
      </main>
    </>
  );
}
