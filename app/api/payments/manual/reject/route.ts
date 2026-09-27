import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { assertAdmin } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/** Rejette une déclaration de paiement manuel (dépôt introuvable, montant erroné, doublon...) */
export async function POST(req: NextRequest) {
  const auth = await assertAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.paymentId) return NextResponse.json({ error: "paymentId requis" }, { status: 400 });

  const admin = createAdminClient();
  const { data: payment } = await admin.from("payments").select("raw_payload").eq("id", body.paymentId).single();

  const { error } = await admin
    .from("payments")
    .update({
      status: "failed",
      raw_payload: { ...(payment?.raw_payload ?? {}), rejectionReason: body.reason ?? "Non précisé" },
    })
    .eq("id", body.paymentId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
