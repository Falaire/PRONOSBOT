import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { PLAN_PRICES_FCFA } from "@/lib/payments/cinetpay";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

/**
 * Paiement manuel (mode transitoire, en attendant l'activation de CinetPay) :
 * l'utilisateur a déjà envoyé l'argent T-Money/Flooz vers le numéro marchand affiché sur
 * /dashboard/abonnement. Ici on enregistre juste sa déclaration ("j'ai payé, voici mes
 * infos") avec le statut "pending" ; un admin vérifie manuellement (SMS reçu sur le numéro
 * marchand) puis valide depuis /admin, ce qui active l'abonnement.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.planCode || !body?.operator || !body?.payerPhone) {
    return NextResponse.json(
      { error: "planCode, operator et payerPhone sont requis" },
      { status: 400 }
    );
  }

  const plan = PLAN_PRICES_FCFA[body.planCode];
  if (!plan) return NextResponse.json({ error: "Plan inconnu" }, { status: 400 });

  if (!["tmoney", "flooz"].includes(body.operator)) {
    return NextResponse.json({ error: "Opérateur invalide (tmoney ou flooz)" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Connectez-vous avant de déclarer un paiement" }, { status: 401 });
  }

  const transactionId = `manual_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const admin = createAdminClient();

  const { data: payment, error } = await admin
    .from("payments")
    .insert({
      user_id: user.id,
      provider: "manual",
      provider_transaction_id: transactionId,
      amount_fcfa: plan.amount,
      status: "pending",
      payment_method: body.operator,
      raw_payload: {
        planCode: body.planCode,
        operator: body.operator,
        payerPhone: body.payerPhone,
        reference: body.reference ?? null,
        note: body.note ?? null,
        declaredAt: new Date().toISOString(),
      },
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, paymentId: payment.id });
}
