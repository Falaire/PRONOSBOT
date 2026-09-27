import Link from "next/link";
import { Home, LineChart, CreditCard, User } from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const items = [
    { href: "/dashboard", label: "Matchs", icon: Home },
    { href: "/dashboard/historique", label: "Précision", icon: LineChart },
    { href: "/dashboard/abonnement", label: "Abonnement", icon: CreditCard },
    { href: "/dashboard/compte", label: "Compte", icon: User },
  ];
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 md:hidden border-t border-white/[0.08] bg-ink-950/90 backdrop-blur-xl">
      <div className="grid grid-cols-4">
        {items.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-col items-center gap-1 py-2.5 text-white/50 hover:text-white text-[11px] transition-colors"
            )}
          >
            <Icon className="w-5 h-5" />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
