import { createClient } from "@/lib/supabase/server";

export type CurrentUserState = {
  userId: string | null;
  isPremium: boolean;
  planCode: string | null;
  /** Statut de l'abonnement courant : "trial" (essai gratuit) ou "active" (payant). */
  subscriptionStatus: "trial" | "active" | null;
  /** Date de fin de l'abonnement courant (ISO), null si aucun abonnement actif. */
  subscriptionEndsAt: string | null;
  trialEndsAt: string | null;
  needsPhone: boolean;
  /** Prénom / nom saisi par l'utilisateur (profiles.full_name), null si pas encore renseigné. */
  fullName: string | null;
};

const EMPTY_STATE: CurrentUserState = {
  userId: null,
  isPremium: false,
  planCode: null,
  subscriptionStatus: null,
  subscriptionEndsAt: null,
  trialEndsAt: null,
  needsPhone: false,
  fullName: null,
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
      return { ...EMPTY_STATE };
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
      supabase.from("profiles").select("phone, full_name").eq("id", user.id).maybeSingle(),
    ]);

    const fullName = profile?.full_name?.trim() || null;

    return {
      userId: user.id,
      isPremium: !!sub,
      planCode: sub?.plan_code ?? null,
      subscriptionStatus: (sub?.status as "trial" | "active" | undefined) ?? null,
      subscriptionEndsAt: sub?.ends_at ?? null,
      trialEndsAt: sub?.status === "trial" ? sub.ends_at : null,
      needsPhone: !profile?.phone,
      fullName,
    };
  } catch {
    return { ...EMPTY_STATE };
  }
}

/** Premier mot du nom saisi ("Jean Paul" -> "Jean"), pour les salutations. */
export function getFirstName(fullName: string | null | undefined): string | null {
  const first = fullName?.trim().split(/\s+/)[0];
  return first ? first : null;
}

export function getFreeLimit(): number {
  return FREE_LIMIT_PER_DAY;
}
