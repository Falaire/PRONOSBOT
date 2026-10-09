import Link from "next/link";
import { Home, LineChart, NotebookPen, CreditCard, User, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCurrentUserState } from "@/lib/subscription";
import { getNavNotificationState } from "@/lib/nav-notifications";
import { NavLinkWithDot } from "@/components/NavLinkWithDot";

const itemClasses = cn(
  "flex flex-col items-center gap-1 py-2.5 text-white/50 hover:text-white text-[11px] transition-colors"
);

export async function BottomNav() {
  const { userId } = await getCurrentUserState();
  const { latestPredictionAt, latestPaymentAt } = await getNavNotificationState(userId);

  // Les liens « Matchs » (nouveaux pronostics) et « Compte » (paiement mis à jour) ont un point.
  const items: { href: string; label: string; icon: LucideIcon; dot?: { key: string; latestAt: string | null } }[] = [
    { href: "/dashboard", label: "Matchs", icon: Home, dot: { key: "matchs", latestAt: latestPredictionAt } },
    { href: "/dashboard/carnet", label: "Carnet", icon: NotebookPen },
    { href: "/dashboard/historique", label: "Précision", icon: LineChart },
    { href: "/dashboard/abonnement", label: "Abonnement", icon: CreditCard },
    { href: "/dashboard/compte", label: "Compte", icon: User, dot: { key: "compte", latestAt: latestPaymentAt } },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 md:hidden border-t border-white/[0.08] bg-ink-950/90 backdrop-blur-xl">
      <div className="grid grid-cols-5">
        {items.map(({ href, label, icon: Icon, dot }) => {
          const content = (
            <>
              <Icon className="w-5 h-5" />
              {label}
            </>
          );
          if (dot) {
            return (
              <NavLinkWithDot
                key={href}
                href={href}
                storageKey={dot.key}
                latestAt={dot.latestAt}
                className={itemClasses}
                dotClassName="top-2 left-[calc(50%+6px)]"
              >
                {content}
              </NavLinkWithDot>
            );
          }
          return (
            <Link key={href} href={href} className={itemClasses}>
              {content}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
