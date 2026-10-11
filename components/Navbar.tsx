import { Button, buttonClasses } from "@/components/ui/button";
import { SignOutButton } from "@/components/SignOutButton";
import Link from "next/link";
import { Zap, Sparkles } from "lucide-react";
import { getCurrentUserState, getFirstName } from "@/lib/subscription";
import { getNavNotificationState } from "@/lib/nav-notifications";
import { NavLinkWithDot } from "@/components/NavLinkWithDot";
import { APP_BADGE } from "@/lib/brand";

export async function Navbar() {
  const { userId, isPremium, fullName } = await getCurrentUserState();
  const firstName = getFirstName(fullName);
  const { latestPredictionAt, latestPaymentAt } = await getNavNotificationState(userId);

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-ink-950/70 backdrop-blur-xl">
      <div className="mx-auto max-w-6xl flex items-center justify-between gap-1.5 sm:gap-2 px-3 sm:px-4 py-3.5">
        <Link href="/" className="flex items-center gap-1.5 sm:gap-2 font-display font-extrabold text-white text-base sm:text-lg shrink-0">
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 shadow-glow">
            <Zap className="w-4 h-4 text-white" fill="currentColor" />
          </span>
          Kick<span className="text-brand-400">Predict</span>
          <span className="hidden sm:inline text-accent-500 text-[10px] font-bold border border-accent-500/40 rounded-full px-2 py-0.5 ml-0.5 tracking-wide">
            {APP_BADGE}
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-7 text-sm text-white/60">
          <NavLinkWithDot
            href="/dashboard"
            storageKey="matchs"
            latestAt={latestPredictionAt}
            className="hover:text-white transition-colors"
            dotClassName="-top-1 -right-2.5"
          >
            Pronostics
          </NavLinkWithDot>
          <Link href="/dashboard/carnet" className="hover:text-white transition-colors">Mon carnet</Link>
          <Link href="/dashboard/abonnement" className="hover:text-white transition-colors">Abonnement</Link>
          <Link href="/dashboard/historique" className="hover:text-white transition-colors">Précision IA</Link>
        </nav>
        <div className="flex items-center gap-1.5 sm:gap-2">
          {userId ? (
            <>
              {firstName && (
                <span className="hidden lg:inline text-sm text-white/70 mr-1">Bonjour {firstName} 👋</span>
              )}
              {isPremium && (
                <span className="hidden sm:flex items-center gap-1 text-[11px] font-bold text-accent-500 border border-accent-500/40 rounded-full px-2.5 py-1">
                  <Sparkles className="w-3 h-3" /> Premium
                </span>
              )}
              <NavLinkWithDot
                href="/dashboard/compte"
                storageKey="compte"
                latestAt={latestPaymentAt}
                className={buttonClasses({ variant: "outline", size: "sm" })}
                dotClassName="-top-0.5 -right-0.5"
              >
                Mon compte
              </NavLinkWithDot>
              <SignOutButton />
            </>
          ) : (
            <>
              <Button href="/connexion" variant="ghost" size="sm" className="whitespace-nowrap px-2 sm:px-4">Connexion</Button>
              <Button href="/inscription" variant="primary" size="sm" className="whitespace-nowrap px-3 sm:px-4">Essai gratuit</Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
