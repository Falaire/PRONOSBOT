import { Button } from "@/components/ui/button";
import Link from "next/link";

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink-900/80 backdrop-blur">
      <div className="mx-auto max-w-6xl flex items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-extrabold text-white text-lg">
          <span className="text-brand-500">Kick</span>Predict
          <span className="text-accent-500 text-xs font-semibold border border-accent-500/40 rounded-full px-2 py-0.5 ml-1">TG</span>
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm text-white/70">
          <Link href="/dashboard" className="hover:text-white">Pronostics</Link>
          <Link href="/dashboard/abonnement" className="hover:text-white">Abonnement</Link>
          <Link href="/dashboard/historique" className="hover:text-white">Précision IA</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Button href="/connexion" variant="ghost" size="sm">Connexion</Button>
          <Button href="/inscription" variant="primary" size="sm">Essai gratuit</Button>
        </div>
      </div>
    </header>
  );
}
