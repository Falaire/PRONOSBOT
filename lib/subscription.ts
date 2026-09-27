import { createClient } from "@/lib/supabase/server";

export type CurrentUserState = {
  userId: string | null;
  isPremium: boolean;
  planCode: string | null;
  trialEndsAt: string | null;
  needsPhone: boolean;
};

const FREE_LIMIT_PER_DAY = 5;

/**
 * Récupère l'utilisateur connecté et son statut d'abonnement.
 * Tolérant aux erreurs : si Supabase n'est pas configuré (démo locale sans .env),
 * renvoie un état "visiteur gratuit" plutôt que de faire planter la page.
 */
export async function getCurrentUserState(): Promise<CurrentUserState> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { userId: null, isPremium: false, planCode: null, trialEndsAt: null, needsPhone: false };
    }

    const [{ data: sub }, { data: profile }] = await Promise.all([
      supabase
        .from("subscriptions")
        .select("plan_code, status, ends_at")
        .eq("user_id", user.id)
        .in("status", ["trial", "active"])
        .gte("ends_at", new Date().toISOString())
        .order("ends_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("profiles").select("phone").eq("id", user.id).maybeSingle(),
    ]);

    return {
      userId: user.id,
      isPremium: !!sub,
      planCode: sub?.plan_code ?? null,
      trialEndsAt: sub?.status === "trial" ? sub.ends_at : null,
      needsPhone: !profile?.phone,
    };
  } catch {
    return { userId: null, isPremium: false, planCode: null, trialEndsAt: null, needsPhone: false };
  }
}


export function getFreeLimit(): number {
  return FREE_LIMIT_PER_DAY;
}
