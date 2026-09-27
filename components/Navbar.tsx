import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Zap } from "lucide-react";

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-ink-950/70 backdrop-blur-xl">
      <div className="mx-auto max-w-6xl flex items-center justify-between px-4 py-3.5">
        <Link href="/" className="flex items-center gap-2 font-display font-extrabold text-white text-lg">
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 shadow-glow">
            <Zap className="w-4 h-4 text-white" fill="currentColor" />
          </span>
          Kick<span className="text-brand-400">Predict</span>
          <span className="text-accent-500 text-[10px] font-bold border border-accent-500/40 rounded-full px-2 py-0.5 ml-0.5 tracking-wide">
            TG
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-7 text-sm text-white/60">
          <Link href="/dashboard" className="hover:text-white transition-colors">Pronostics</Link>
          <Link href="/dashboard/abonnement" className="hover:text-white transition-colors">Abonnement</Link>
          <Link href="/dashboard/historique" className="hover:text-white transition-colors">Précision IA</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Button href="/connexion" variant="ghost" size="sm">Connexion</Button>
          <Button href="/inscription" variant="primary" size="sm">Essai gratuit</Button>
        </div>
      </div>
    </header>
  );
}
