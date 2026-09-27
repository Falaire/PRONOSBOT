import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

/**
 * Autorise l'appel si :
 *  - l'en-tête Authorization: Bearer <CRON_SECRET> correspond (appel Vercel Cron), OU
 *  - l'utilisateur connecté (cookies) a le rôle "admin" (déclenchement manuel depuis /admin).
 */
/**
 * Autorise uniquement un utilisateur connecté avec le rôle "admin" (pas de bypass CRON_SECRET).
 * À utiliser pour les actions sensibles déclenchées à la main (ex: valider un paiement manuel).
 */
export async function assertAdmin(): Promise<{ ok: boolean; reason?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, reason: "Non authentifié" };

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") return { ok: false, reason: "Accès réservé aux administrateurs" };

    return { ok: true };
  } catch {
    return { ok: false, reason: "Impossible de vérifier les droits" };
  }
}

export async function assertAdminOrCron(req: NextRequest): Promise<{ ok: boolean; reason?: string }> {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return { ok: true };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, reason: "Non authentifié" };

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") return { ok: false, reason: "Accès réservé aux administrateurs" };

    return { ok: true };
  } catch {
    return { ok: false, reason: "Impossible de vérifier les droits" };
  }
}
