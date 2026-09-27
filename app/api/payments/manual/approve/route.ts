import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { assertAdmin } from "@/lib/api-auth";
import { PLAN_PRICES_FCFA } from "@/lib/payments/cinetpay";

export const dynamic = "force-dynamic";

/**
 * Validation manuelle par un admin : après avoir vérifié la réception réelle du dépôt Mobile
 * Money (SMS reçu sur le numéro marchand T-Money/Flooz), l'admin clique "Valider" dans /admin.
 * Cela active l'abonnement de l'utilisateur. Si un abonnement actif existe déjà, la nouvelle
 * période est ajoutée à la suite (l'utilisateur ne perd pas de jours déjà payés).
 */
export async function POST(req: NextRequest) {
  const auth = await assertAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.paymentId) return NextResponse.json({ error: "paymentId requis" }, { status: 400 });

  const admin = createAdminClient();

  const { data: payment, error: fetchError } = await admin
    .from("payments")
    .select("*")
    .eq("id", body.paymentId)
    .single();

  if (fetchError || !payment) {
    return NextResponse.json({ error: "Paiement introuvable" }, { status: 404 });
  }
  if (payment.status === "success") {
    return NextResponse.json({ error: "Ce paiement a déjà été validé" }, { status: 409 });
  }

  const planCode = payment.raw_payload?.planCode as string;
  const plan = PLAN_PRICES_FCFA[planCode];
  if (!plan) return NextResponse.json({ error: "Plan introuvable dans le paiement" }, { status: 400 });

  // Cherche un abonnement encore actif pour prolonger la date de fin plutôt que de l'écraser
  const { data: current } = await admin
    .from("subscriptions")
    .select("ends_at")
    .eq("user_id", payment.user_id)
    .in("status", ["trial", "active"])
    .gte("ends_at", new Date().toISOString())
    .order("ends_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const startBase = current?.ends_at ? new Date(current.ends_at) : new Date();
  const endsAt = new Date(startBase.getTime() + plan.days * 24 * 3600 * 1000);

  const { data: subscription, error: subError } = await admin
    .from("subscriptions")
    .insert({
      user_id: payment.user_id,
      plan_code: planCode,
      status: "active",
      started_at: new Date().toISOString(),
      ends_at: endsAt.toISOString(),
      amount_fcfa: plan.amount,
    })
    .select()
    .single();

  if (subError) return NextResponse.json({ error: subError.message }, { status: 500 });

  await admin
    .from("payments")
    .update({
      status: "success",
      subscription_id: subscription.id,
      confirmed_at: new Date().toISOString(),
    })
    .eq("id", payment.id);

  return NextResponse.json({ ok: true, subscriptionId: subscription.id, endsAt: endsAt.toISOString() });
}
