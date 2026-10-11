import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const MIN_LENGTH = 2;
const MAX_LENGTH = 40;

/**
 * Enregistre le prénom (ou nom affiché) de l'utilisateur connecté dans profiles.full_name.
 * Utilise le client Supabase standard (session de l'utilisateur) : la policy RLS
 * `profiles_update_own` (auth.uid() = id) autorise déjà cette mise à jour, donc pas besoin du
 * client service_role.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const raw = typeof body?.fullName === "string" ? body.fullName : "";
  const fullName = raw.replace(/\s+/g, " ").trim();

  if (fullName.length < MIN_LENGTH || fullName.length > MAX_LENGTH) {
    return NextResponse.json(
      { error: `Le prénom doit contenir entre ${MIN_LENGTH} et ${MAX_LENGTH} caractères.` },
      { status: 400 }
    );
  }
  // Lettres (y compris accentuées), espaces, apostrophes et tirets uniquement.
  if (!/^\p{L}[\p{L}\s'’-]*$/u.test(fullName)) {
    return NextResponse.json(
      { error: "Utilise uniquement des lettres, espaces, apostrophes ou tirets." },
      { status: 400 }
    );
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Connecte-toi d'abord" }, { status: 401 });
    }

    // .select().single() : si la mise à jour ne touche aucune ligne (RLS, profil absent), on le
    // détecte au lieu de renvoyer un succès silencieux.
    const { data, error } = await supabase
      .from("profiles")
      .update({ full_name: fullName })
      .eq("id", user.id)
      .select("full_name")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Impossible d'enregistrer ton prénom, réessaie." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, fullName: data.full_name });
  } catch {
    return NextResponse.json({ error: "Service temporairement indisponible, réessaie." }, { status: 503 });
  }
}
