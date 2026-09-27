import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PricingCard } from "@/components/PricingCard";
import { MatchCard } from "@/components/MatchCard";
import { DEMO_FIXTURES } from "@/lib/demo-data";
import { Brain, ShieldCheck, Smartphone, MessageCircle, Trophy, LineChart } from "lucide-react";
import Link from "next/link";

const FEATURES = [
  {
    icon: Brain,
    title: "Agent IA de prédiction",
    desc: "Probabilités 1X2, Over/Under, BTTS, score probable et indice de confiance sur chaque match, expliqués en français simple.",
  },
  {
    icon: Trophy,
    title: "Ligues africaines en priorité",
    desc: "Ligue 1 Togo, CAN, Ligue des Champions CAF, championnats CEDEAO + top 5 championnats européens.",
  },
  {
    icon: LineChart,
    title: "Mode Value Bet",
    desc: "Comparaison automatique entre la probabilité de l'IA et les cotes du marché pour repérer les paris à valeur.",
  },
  {
    icon: MessageCircle,
    title: "Alertes WhatsApp / Telegram",
    desc: "Recevez les pronostics du jour directement sur WhatsApp ou Telegram, sans ouvrir l'appli.",
  },
  {
    icon: Smartphone,
    title: "Mobile-first, léger",
    desc: "Interface ultra rapide, pensée pour les smartphones d'entrée de gamme et une connexion 3G.",
  },
  {
    icon: ShieldCheck,
    title: "Paiement 100% local",
    desc: "T-Money (Mixx by Yas) et Flooz (Moov Africa). Aucune carte bancaire nécessaire.",
  },
];

const PLANS = [
  { code: "hebdo", name: "Hebdo", priceFcfa: 1000, durationDays: 7, features: ["Accès illimité 7 jours", "Alertes Telegram", "Idéal pour tester"] },
  { code: "mensuel", name: "Mensuel", priceFcfa: 3000, durationDays: 30, highlighted: true, features: ["Accès illimité", "Analyses détaillées + explications", "Alertes WhatsApp/Telegram", "Mode Value Bet"] },
  { code: "trimestriel", name: "Trimestriel", priceFcfa: 7500, durationDays: 90, perMonthFcfa: 2500, features: ["Tout Mensuel", "-17% vs mensuel", "Support prioritaire"] },
  { code: "annuel", name: "Annuel", priceFcfa: 25000, durationDays: 365, perMonthFcfa: 2083, features: ["Tout Trimestriel", "-30% vs mensuel", "2 mois offerts"] },
];

export default function LandingPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        {/* HERO */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-brand-900/40 via-ink-900 to-ink-900" />
          <div className="relative mx-auto max-w-6xl px-4 pt-14 pb-16 text-center">
            <span className="inline-block rounded-full border border-brand-500/40 bg-brand-500/10 px-4 py-1 text-xs font-semibold text-brand-400 mb-5">
              🇹🇬 Fait pour le Togo et l'UEMOA
            </span>
            <h1 className="text-3xl sm:text-5xl font-extrabold leading-tight text-white">
              Les pronostics foot par <span className="text-brand-500">Intelligence Artificielle</span>,
              <br className="hidden sm:block" /> payables en <span className="text-accent-500">T-Money / Flooz</span>
            </h1>
            <p className="mt-5 text-white/70 max-w-2xl mx-auto">
              KickPredict analyse la forme des joueurs, le jeu collectif et l'historique des confrontations pour
              vous donner une probabilité claire, un score probable et une explication simple avant chaque match.
            </p>
            <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
              <Button href="/inscription" size="lg">Essai gratuit 3 jours</Button>
              <Button href="#pricing" variant="outline" size="lg">Voir les tarifs</Button>
            </div>
            <p className="mt-3 text-xs text-white/40">Sans carte bancaire. Résiliable à tout moment. 18+.</p>
          </div>
        </section>

        {/* MATCHS DU JOUR (aperçu) */}
        <section className="mx-auto max-w-6xl px-4 py-10">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-bold text-white">Pronostics du jour</h2>
            <Link href="/dashboard" className="text-sm text-brand-400 font-semibold hover:underline">Voir tout →</Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {DEMO_FIXTURES.slice(0, 3).map((f) => (
              <MatchCard key={f.id} fixture={f} locked={!f.free} />
            ))}
          </div>
        </section>

        {/* FEATURES */}
        <section className="mx-auto max-w-6xl px-4 py-10">
          <h2 className="text-xl font-bold text-white mb-6 text-center">Pourquoi KickPredict ?</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <Card key={title}>
                <Icon className="w-6 h-6 text-brand-500 mb-3" />
                <h3 className="font-semibold text-white mb-1">{title}</h3>
                <p className="text-sm text-white/60">{desc}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* PRICING */}
        <section id="pricing" className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-xl font-bold text-white mb-2 text-center">Abonnement en FCFA</h2>
          <p className="text-center text-white/60 mb-8 text-sm">Paiement Mobile Money instantané — T-Money & Flooz</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PLANS.map((p) => (
              <PricingCard key={p.code} plan={p} />
            ))}
          </div>
        </section>

        {/* WHATSAPP CTA */}
        <section className="mx-auto max-w-4xl px-4 pb-16">
          <Card className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-brand-500/10 border-brand-500/30">
            <div>
              <h3 className="font-bold text-white">Recevez les pronostics du jour sur WhatsApp</h3>
              <p className="text-sm text-white/60">Gratuit à l'inscription, sans installer d'application.</p>
            </div>
            <Button href="https://wa.me/22890000000" variant="secondary">Rejoindre sur WhatsApp</Button>
          </Card>
        </section>

        {/* DISCLAIMER LEGAL */}
        <section className="mx-auto max-w-4xl px-4 pb-16 text-center">
          <p className="text-xs text-white/40 leading-relaxed">
            KickPredict Togo est un service d'analyse statistique et d'information sportive (18+). Nous ne sommes
            ni un bookmaker ni un opérateur de jeux d'argent : nous ne prenons aucun pari et ne garantissons aucun
            gain. Les pronostics sont fournis à titre indicatif. Jouez de manière responsable.{" "}
            <Link href="/legal/cgu" className="underline">CGU</Link> ·{" "}
            <Link href="/legal/confidentialite" className="underline">Confidentialité</Link>
          </p>
        </section>
      </main>

      <footer className="border-t border-white/10 py-6 text-center text-xs text-white/40">
        © {new Date().getFullYear()} KickPredict Togo — Lomé, Togo
      </footer>
    </>
  );
}
