import { createClient } from "@/lib/supabase/server";

/**
 * Horodatages utilisés pour afficher les petits points de notification dans la navigation :
 *  - latestPredictionAt : dernier pronostic généré pour un match des 48 prochaines heures
 *    (predictions.generated_at, match joint via fixtures.kickoff_at). Alimente le point "Matchs".
 *  - latestPaymentAt : dernière mise à jour d'un paiement de l'utilisateur passé à un statut
 *    non-pending (success / failed). Alimente le point "Compte".
 *
 * Le côté client compare ces valeurs à ce qui est mémorisé dans localStorage (voir
 * components/NavLinkWithDot.tsx) : le point disparaît au clic sur le lien.
 * Tolérant aux erreurs : en cas de problème, renvoie null pour ne rien afficher.
 */
export type NavNotificationState = {
  latestPredictionAt: string | null;
  latestPaymentAt: string | null;
};

const EMPTY: NavNotificationState = { latestPredictionAt: null, latestPaymentAt: null };

export async function getNavNotificationState(userId: string | null): Promise<NavNotificationState> {
  if (!userId) return { ...EMPTY };

  try {
    const supabase = await createClient();
    const now = new Date();
    const in48h = new Date(now.getTime() + 48 * 3600 * 1000);

    const [predictionRes, paymentRes] = await Promise.all([
      supabase
        .from("predictions")
        .select("generated_at, fixtures!inner(kickoff_at)")
        .gte("fixtures.kickoff_at", now.toISOString())
        .lte("fixtures.kickoff_at", in48h.toISOString())
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("payments")
        .select("created_at, confirmed_at")
        .eq("user_id", userId)
        .neq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    const latestPredictionAt = (predictionRes.data?.generated_at as string | undefined) ?? null;

    // Le plus récent parmi confirmed_at (ou created_at à défaut) sur les derniers paiements.
    let latestPaymentAt: string | null = null;
    for (const row of paymentRes.data ?? []) {
      const ts = (row.confirmed_at ?? row.created_at) as string | null;
      if (ts && (!latestPaymentAt || new Date(ts) > new Date(latestPaymentAt))) {
        latestPaymentAt = ts;
      }
    }

    return { latestPredictionAt, latestPaymentAt };
  } catch {
    return { ...EMPTY };
  }
}
