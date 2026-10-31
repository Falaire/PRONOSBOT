import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyTransaction, PLAN_PRICES_FCFA } from "@/lib/payments/cinetpay";

export const dynamic = "force-dynamic";

/**
 * Webhook CinetPay (notify_url), appelé server-to-server à la fin du paiement.
 *
 * Sécurité : on NE FAIT JAMAIS confiance au corps de la requête entrante (il peut être
 * falsifié). On récupère seulement le transaction_id, puis on rappelle systématiquement
 * l'API CinetPay /payment/check pour connaître le statut réel avant d'activer quoi que ce
 * soit. C'est ce pattern qui rend l'activation d'abonnement fiable et non-forgeable.
 */
export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";
  let transactionId: string | undefined;

  if (contentType.includes("application/json")) {
    const body = await req.json().catch(() => ({}));
    transactionId = body.cpm_trans_id ?? body.transaction_id;
  } else {
    const form = await req.formData().catch(() => null);
    transactionId = (form?.get("cpm_trans_id") as string) ?? (form?.get("transaction_id") as string) ?? undefined;
  }

  if (!transactionId) {
    return NextResponse.json({ error: "transaction_id manquant" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: payment } = await admin
    .from("payments")
    .select("*")
    .eq("provider_transaction_id", transactionId)
    .single();

  if (!payment) {
    return NextResponse.json({ error: "Transaction inconnue" }, { status: 404 });
  }

  // IDEMPOTENCE. La route est publiquement joignable par conception (notify_url server-to-server,
  // sans session) : elle doit donc etre rejouable SANS EFFET. Sans ce garde, n'importe quel abonne
  // qui rejoue son propre transaction_id (il lui a ete renvoye par /init) recoit un abonnement de
  // plus a chaque appel, et getCurrentUserState() lit le ends_at le plus recent -> Premium a vie
  // pour un mois paye. Le retry de CinetPay produirait le meme effet sans intervention d'un tiers.
  if (payment.status === "success") {
    return NextResponse.json({ ok: true, status: "ALREADY_CREDITED", subscriptionId: payment.subscription_id });
  }

  // Étape de vérification côté serveur — jamais de confiance aveugle dans le payload reçu
  const verification = await verifyTransaction(transactionId);

  if (verification.status !== "ACCEPTED") {
    await admin
      .from("payments")
      .update({ status: verification.status === "REFUSED" ? "failed" : "pending", raw_payload: verification.raw })
      .eq("id", payment.id);
    return NextResponse.json({ ok: true, status: verification.status });
  }

  const planCode = payment.raw_payload?.planCode as string;
  const plan = PLAN_PRICES_FCFA[planCode];
  if (!plan) {
    return NextResponse.json({ error: "Plan introuvable dans le paiement" }, { status: 400 });
  }

  // Controle du montant cote serveur. /init fixe deja le prix depuis PLAN_PRICES_FCFA (jamais depuis
  // le client), donc ce n'est pas une faille ouverte aujourd'hui : c'est ce qui empechera le prochain
  // operateur de paiement, ou un paiement cree a la main dans le dashboard CinetPay, de le devenir.
  if (verification.amount !== undefined && Number(verification.amount) !== plan.amount) {
    await admin
      .from("payments")
      .update({ status: "failed", raw_payload: verification.raw })
      .eq("id", payment.id);
    return NextResponse.json(
      { error: `Montant verifie (${verification.amount}) different du prix du plan (${plan.amount})` },
      { status: 409 }
    );
  }

  const paymentMethod = mapPaymentMethod(verification.paymentMethod);
  const startedAt = new Date();

  // CUMUL, pas remplacement : un abonne qui renouvelle a J+25 d'un mois de 30 jours ne doit pas
  // perdre 25 jours payes. On repart de la fin de l'abonnement encore actif s'il y en a un
  // (logique identique a app/api/payments/manual/approve/route.ts l.43-51).
  const { data: courant } = await admin
    .from("subscriptions")
    .select("ends_at")
    .eq("user_id", payment.user_id)
    .in("status", ["trial", "active"])
    .gte("ends_at", new Date().toISOString())
    .order("ends_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const startBase = courant?.ends_at ? new Date(courant.ends_at) : startedAt;
  const endsAt = new Date(startBase.getTime() + plan.days * 24 * 3600 * 1000);

  // Crée l'abonnement (idempotent grâce à provider_transaction_id unique sur payments)
  const { data: subscription, error: subError } = await admin
    .from("subscriptions")
    .insert({
      user_id: payment.user_id,
      plan_code: planCode,
      status: "active",
      started_at: startedAt.toISOString(),
      ends_at: endsAt.toISOString(),
      amount_fcfa: plan.amount,
      payment_id: payment.id, // <- contrainte d'unicite en base: see migration 0006
    })
    .select()
    .single();

  if (subError) {
    return NextResponse.json({ error: subError.message }, { status: 500 });
  }

  await admin
    .from("payments")
    .update({
      status: "success",
      payment_method: paymentMethod,
      subscription_id: subscription.id,
      raw_payload: verification.raw,
      confirmed_at: new Date().toISOString(),
    })
    .eq("id", payment.id);

  return NextResponse.json({ ok: true, status: "ACCEPTED", subscriptionId: subscription.id });
}

function mapPaymentMethod(method?: string): "tmoney" | "flooz" | "gozem" | "card" | "unknown" {
  if (!method) return "unknown";
  const m = method.toUpperCase();
  if (m.includes("TMONEY") || m.includes("T-MONEY") || m.includes("MIXX")) return "tmoney";
  if (m.includes("FLOOZ") || m.includes("MOOV")) return "flooz";
  if (m.includes("GOZEM")) return "gozem";
  if (m.includes("CARD") || m.includes("VISA") || m.includes("MASTERCARD")) return "card";
  return "unknown";
}
