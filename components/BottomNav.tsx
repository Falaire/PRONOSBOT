import { getCurrentUserState } from "@/lib/subscription";
import { getNavNotificationState } from "@/lib/nav-notifications";
import { BottomNavBar, type BottomNavItem } from "@/components/BottomNavBar";

/**
 * Calcule côté serveur les horodatages des points de nouveauté, puis délègue l'affichage et
 * l'animation de l'onglet actif au composant client BottomNavBar.
 */
export async function BottomNav() {
  const { userId } = await getCurrentUserState();
  const { latestPredictionAt, latestPaymentAt } = await getNavNotificationState(userId);

  // Les liens « Matchs » (nouveaux pronostics) et « Compte » (paiement mis à jour) ont un point.
  const items: BottomNavItem[] = [
    { href: "/dashboard", label: "Matchs", iconKey: "home", dot: { key: "matchs", latestAt: latestPredictionAt } },
    { href: "/dashboard/carnet", label: "Carnet", iconKey: "notebook" },
    { href: "/dashboard/historique", label: "Précision", iconKey: "chart" },
    { href: "/dashboard/abonnement", label: "Abonnement", iconKey: "card" },
    { href: "/dashboard/compte", label: "Compte", iconKey: "user", dot: { key: "compte", latestAt: latestPaymentAt } },
  ];

  return <BottomNavBar items={items} />;
}
