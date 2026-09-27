import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isValidTogoPhone, toE164Togo } from "@/lib/phone";

export const dynamic = "force-dynamic";

const TRIAL_DAYS = 3;

/**
 * Étape obligatoire après la vérification de l'email : associe un numéro de téléphone au
 * compte, et déclenche l'essai gratuit — au maximum UNE fois par numéro de téléphone, pour
 * toujours (voir supabase/migrations/0003_phone_trial_gate.sql). Ça évite de pouvoir
 * réclamer un nouvel essai gratuit en changeant simplement d'adresse email (temp-mail...).
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.phone || typeof body.phone !== "string") {
    return NextResponse.json({ error: "Numéro de téléphone requis" }, { status: 400 });
  }

  if (!isValidTogoPhone(body.phone)) {
    return NextResponse.json(
      { error: "Numéro invalide. Utilise un numéro togolais à 8 chiffres (ex: 90 12 34 56)." },
      { status: 400 }
    );
  }

  const phone = toE164Togo(body.phone);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Connecte-toi d'abord" }, { status: 401 });
  }

  const admin = createAdminClient();

  // 1. Ce numéro est-il déjà associé à un AUTRE compte ?
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("phone", phone)
    .neq("id", user.id)
    .maybeSingle();

  if (existingProfile) {
    return NextResponse.json(
      { error: "Ce numéro est déjà associé à un autre compte." },
      { status: 409 }
    );
  }

  // 2. Enregistre le numéro sur le profil.
  const { error: updateError } = await admin.from("profiles").update({ phone }).eq("id", user.id);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // 3. Ce numéro a-t-il déjà servi à réclamer un essai gratuit (même sur un compte supprimé
  //    depuis) ? Si oui, on n'accorde pas de nouvel essai — le compte reste utilisable en mode
  //    gratuit limité, mais devra passer par un abonnement payant pour le mode Premium.
  const { data: ledgerRow } = await admin
    .from("trial_phone_ledger")
    .select("phone")
    .eq("phone", phone)
    .maybeSingle();

  if (ledgerRow) {
    return NextResponse.json({ ok: true, trialGranted: false });
  }

  const { error: ledgerError } = await admin
    .from("trial_phone_ledger")
    .insert({ phone, user_id: user.id });

  if (ledgerError) {
    // Conflit probable (insertion concurrente) : on ne bloque pas l'utilisateur pour ça.
    return NextResponse.json({ ok: true, trialGranted: false });
  }

  const endsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { error: subError } = await admin.from("subscriptions").insert({
    user_id: user.id,
    plan_code: "hebdo",
    status: "trial",
    ends_at: endsAt,
    amount_fcfa: 0,
  });

  if (subError) {
    return NextResponse.json({ ok: true, trialGranted: false });
  }

  return NextResponse.json({ ok: true, trialGranted: true });
}
