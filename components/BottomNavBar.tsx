"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LineChart, NotebookPen, CreditCard, User, type LucideIcon } from "lucide-react";
import { AnimatedBackground } from "@/components/motion/animated-background";
import { NavDot } from "@/components/NavDot";

export type BottomNavIconKey = "home" | "notebook" | "chart" | "card" | "user";

export type BottomNavItem = {
  href: string;
  label: string;
  iconKey: BottomNavIconKey;
  dot?: { key: string; latestAt: string | null };
};

const ICONS: Record<BottomNavIconKey, LucideIcon> = {
  home: Home,
  notebook: NotebookPen,
  chart: LineChart,
  card: CreditCard,
  user: User,
};

/** Onglet actif : correspondance exacte pour /dashboard, sinon le chemin ou ses sous-pages. */
function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Barre de navigation mobile. L'onglet actif est mis en évidence par un fond qui glisse d'un
 * onglet à l'autre (AnimatedBackground, motion-primitives), et le point de nouveauté est géré
 * par NavDot.
 */
export function BottomNavBar({ items }: { items: BottomNavItem[] }) {
  const pathname = usePathname() ?? "";
  const activeHref = items.find((item) => isActive(pathname, item.href))?.href;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 md:hidden border-t border-white/[0.08] bg-ink-950/90 backdrop-blur-xl">
      <div className="grid grid-cols-5 px-1.5 py-1">
        <AnimatedBackground
          defaultValue={activeHref}
          className="rounded-xl bg-brand-500/15 border border-brand-500/25"
          transition={{ type: "spring", bounce: 0.2, duration: 0.45 }}
        >
          {items.map((item) => {
            const Icon = ICONS[item.iconKey];
            return (
              <Link
                key={item.href}
                data-id={item.href}
                href={item.href}
                className="relative flex flex-col items-center py-2 text-[11px] text-white/50 hover:text-white data-[checked=true]:text-brand-400 transition-colors"
              >
                <span className="flex flex-col items-center gap-1">
                  <Icon className="w-5 h-5" />
                  {item.label}
                </span>
                {item.dot && (
                  <NavDot
                    href={item.href}
                    storageKey={item.dot.key}
                    latestAt={item.dot.latestAt}
                    className="top-1.5 left-[calc(50%+6px)]"
                  />
                )}
              </Link>
            );
          })}
        </AnimatedBackground>
      </div>
    </nav>
  );
}
