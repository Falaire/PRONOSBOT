import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { initPayment, PLAN_PRICES_FCFA } from "@/lib/payments/cinetpay";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

/**
 * Initialise une transaction Mobile Money (T-Money / Flooz) via CinetPay pour le plan choisi.
 * Le montant est TOUJOURS déterminé côté serveur (PLAN_PRICES_FCFA), jamais envoyé par le
 * client, pour éviter toute manipulation du prix.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.planCode || !body?.phone) {
    return NextResponse.json({ error: "planCode et phone sont requis" }, { status: 400 });
  }

  const plan = PLAN_PRICES_FCFA[body.planCode];
  if (!plan) return NextResponse.json({ error: "Plan inconnu" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Connectez-vous avant de payer" }, { status: 401 });
  }

  const transactionId = `kp_${Date.now()}_${randomUUID().slice(0, 8)}`;

  try {
    const admin = createAdminClient();

    // Trace la tentative de paiement en base AVANT redirection (statut "pending")
    await admin.from("payments").insert({
      user_id: user.id,
      provider: "cinetpay",
      provider_transaction_id: transactionId,
      amount_fcfa: plan.amount,
      status: "pending",
      raw_payload: { planCode: body.planCode, phone: body.phone },
    });

    const result = await initPayment({
      transactionId,
      amountFcfa: plan.amount,
      description: `Abonnement KickPredict Togo — ${plan.label}`,
      customerName: user.user_metadata?.full_name ?? "Client KickPredict",
      customerPhone: body.phone,
      customerEmail: user.email,
      metadata: JSON.stringify({ userId: user.id, planCode: body.planCode }),
    });

    return NextResponse.json({ paymentUrl: result.paymentUrl, transactionId });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Erreur d'initialisation du paiement" }, { status: 500 });
  }
}
