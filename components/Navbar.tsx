import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/components/SignOutButton";
import Link from "next/link";
import { Zap, Sparkles } from "lucide-react";
import { getCurrentUserState } from "@/lib/subscription";
import { APP_BADGE } from "@/lib/brand";

export async function Navbar() {
  const { userId, isPremium } = await getCurrentUserState();

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-ink-950/70 backdrop-blur-xl">
      <div className="mx-auto max-w-6xl flex items-center justify-between px-4 py-3.5">
        <Link href="/" className="flex items-center gap-2 font-display font-extrabold text-white text-lg">
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 shadow-glow">
            <Zap className="w-4 h-4 text-white" fill="currentColor" />
          </span>
          Kick<span className="text-brand-400">Predict</span>
          <span className="text-accent-500 text-[10px] font-bold border border-accent-500/40 rounded-full px-2 py-0.5 ml-0.5 tracking-wide">
            {APP_BADGE}
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-7 text-sm text-white/60">
          <Link href="/dashboard" className="hover:text-white transition-colors">Pronostics</Link>
          <Link href="/dashboard/carnet" className="hover:text-white transition-colors">Mon carnet</Link>
          <Link href="/dashboard/abonnement" className="hover:text-white transition-colors">Abonnement</Link>
          <Link href="/dashboard/historique" className="hover:text-white transition-colors">Précision IA</Link>
        </nav>
        <div className="flex items-center gap-2">
          {userId ? (
            <>
              {isPremium && (
                <span className="hidden sm:flex items-center gap-1 text-[11px] font-bold text-accent-500 border border-accent-500/40 rounded-full px-2.5 py-1">
                  <Sparkles className="w-3 h-3" /> Premium
                </span>
              )}
              <Button href="/dashboard/compte" variant="outline" size="sm">
                Mon compte
              </Button>
              <SignOutButton />
            </>
          ) : (
            <>
              <Button href="/connexion" variant="ghost" size="sm">Connexion</Button>
              <Button href="/inscription" variant="primary" size="sm">Essai gratuit</Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
