import { redirect } from "next/navigation";
import { getCurrentUserState } from "@/lib/subscription";
import { MotionProvider } from "@/components/motion/MotionProvider";

/**
 * Garde-fou : un utilisateur connecté sans numéro de téléphone enregistré est renvoyé vers
 * l'étape de finalisation du profil avant d'accéder à tout le tableau de bord (même s'il
 * arrive directement sur /dashboard/... via un favori/lien direct).
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId, needsPhone } = await getCurrentUserState();
  if (userId && needsPhone) {
    redirect("/completer-profil");
  }
  return <MotionProvider>{children}</MotionProvider>;
}
