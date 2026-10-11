import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PricingCard } from "@/components/PricingCard";
import { MatchCard } from "@/components/MatchCard";
import { FAQ } from "@/components/FAQ";
import { TextEffect } from "@/components/motion/text-effect";
import { AnimatedGroup } from "@/components/motion/animated-group";
import { InView } from "@/components/motion/in-view";
import { BorderTrail } from "@/components/motion/border-trail";
import { MotionProvider } from "@/components/motion/MotionProvider";
import { DEMO_FIXTURES } from "@/lib/demo-data";
import { MANUAL_PAYMENT_INFO } from "@/lib/payments/config";
import { APP_NAME, APP_NAME_FULL } from "@/lib/brand";
import {
  Brain,
  ShieldCheck,
  Smartphone,
  MessageCircle,
  Trophy,
  LineChart,
  Mail,
  Phone,
  Sparkles,
  ArrowRight,
} from "lucide-react";
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

const STEPS = [
  {
    icon: Mail,
    title: "Crée ton compte",
    desc: "Email + code de vérification. Trente secondes, sans mot de passe à retenir.",
  },
  {
    icon: Phone,
    title: "Active ton essai gratuit",
    desc: "Un numéro de téléphone, 3 jours d'accès complet offerts — sans carte bancaire.",
  },
  {
    icon: Sparkles,
    title: "Reçois tes pronostics",
    desc: "Chaque matin, les analyses IA du jour, sur l'appli et par WhatsApp/Telegram.",
  },
];

const LEAGUES_COVERED = [
  "Ligue 1 Togo",
  "Coupe d'Afrique des Nations",
  "Ligue des Champions CAF",
  "Ligue 1 Côte d'Ivoire",
  "Ligue 1 Sénégal",
  "Ligue des Champions UEFA",
  "Premier League",
  "LaLiga",
  "Serie A",
  "Bundesliga",
  "Ligue 1",
];

const PLANS = [
  { code: "hebdo", name: "Hebdo", priceFcfa: 1000, durationDays: 7, features: ["Accès illimité 7 jours", "Alertes Telegram", "Idéal pour tester"] },
  { code: "mensuel", name: "Mensuel", priceFcfa: 3000, durationDays: 30, highlighted: true, features: ["Accès illimité", "Analyses détaillées + explications", "Alertes WhatsApp/Telegram", "Mode Value Bet"] },
  { code: "trimestriel", name: "Trimestriel", priceFcfa: 7500, durationDays: 90, perMonthFcfa: 2500, features: ["Tout Mensuel", "-17% vs mensuel", "Support prioritaire"] },
  { code: "annuel", name: "Annuel", priceFcfa: 25000, durationDays: 365, perMonthFcfa: 2083, features: ["Tout Trimestriel", "-30% vs mensuel", "2 mois offerts"] },
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      name: APP_NAME_FULL,
      url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
      inLanguage: "fr",
    },
    {
      "@type": "Organization",
      name: APP_NAME_FULL,
      url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
      logo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/icons/icon-512.png`,
    },
  ],
};

export default function LandingPage() {
  return (
    <MotionProvider>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      <Navbar />
      <main className="flex-1">
        {/* HERO */}
        <section className="relative overflow-hidden bg-aurora">
          <div className="absolute inset-0 opacity-40 bg-dot-grid [mask-image:linear-gradient(to_bottom,black,transparent)]" aria-hidden />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-40 sm:h-56 bg-[url(/motifs/hero-waves.svg)] bg-cover bg-bottom bg-no-repeat"
            aria-hidden
          />
          <div className="relative mx-auto max-w-6xl px-4 pt-16 sm:pt-24 pb-20 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-500/30 bg-brand-500/10 px-4 py-1.5 text-xs font-semibold text-brand-400 mb-6 animate-fade-up">
              🌍 Conçu pour l&apos;Afrique de l&apos;Ouest et Centrale
            </span>
            <h1 className="text-4xl sm:text-6xl font-extrabold leading-[1.08] text-white tracking-tight">
              <TextEffect as="span" per="word" preset="fade-in-blur" speedReveal={1.6} className="block sm:inline">
                Les pronostics foot par
              </TextEffect>
              <br className="hidden sm:block" />{" "}
              <span className="bg-gradient-to-r from-brand-400 via-brand-500 to-accent-500 bg-clip-text text-transparent">
                Intelligence Artificielle
              </span>
            </h1>
            <p
              className="mt-6 text-white/60 max-w-2xl mx-auto text-base sm:text-lg animate-fade-up"
              style={{ animationDelay: "160ms" }}
            >
              KickPredict analyse la forme des équipes, le jeu collectif et l'historique des confrontations pour
              vous donner une probabilité claire, un score probable et une explication simple avant chaque match —
              payable en <span className="text-white font-medium">T-Money / Flooz</span>.
            </p>
            <div
              className="mt-9 flex items-center justify-center gap-3 flex-wrap animate-fade-up"
              style={{ animationDelay: "240ms" }}
            >
              <Button href="/inscription" size="lg" className="group">
                Essai gratuit 3 jours
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </Button>
              <Button href="#pricing" variant="outline" size="lg">Voir les tarifs</Button>
            </div>
            <p className="mt-4 text-xs text-white/35">Sans carte bancaire. Résiliable à tout moment. 18+.</p>

            {/* Bandeau de confiance */}
            <div
              className="mt-14 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-white/40 animate-fade-up"
              style={{ animationDelay: "320ms" }}
            >
              <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-brand-500" /> Paiement Mobile Money sécurisé</span>
              <span className="flex items-center gap-1.5"><Brain className="w-3.5 h-3.5 text-brand-500" /> Modèle statistique Elo + Poisson</span>
              <span className="flex items-center gap-1.5"><MessageCircle className="w-3.5 h-3.5 text-brand-500" /> Support WhatsApp réactif</span>
            </div>
          </div>

          {/* Bande des ligues couvertes — défilement continu */}
          <div className="relative border-t border-white/[0.06] py-5 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
            <div className="flex items-center gap-3 w-max animate-marquee">
              {[...LEAGUES_COVERED, ...LEAGUES_COVERED].map((league, i) => (
                <span
                  key={`${league}-${i}`}
                  className="shrink-0 text-xs font-medium text-white/45 border border-white/10 rounded-full px-3.5 py-1.5 whitespace-nowrap"
                >
                  {league}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* COMMENT ÇA MARCHE */}
        <section className="mx-auto max-w-6xl px-4 py-14">
          <InView viewOptions={{ once: true }} once variants={{ hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } }}>
          <div className="grid sm:grid-cols-3 gap-4 sm:gap-6 relative">
            <div className="hidden sm:block absolute top-7 left-[16.6%] right-[16.6%] h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
            {STEPS.map(({ icon: Icon, title, desc }, i) => (
              <div key={title} className="relative flex flex-col items-center text-center gap-3">
                <div className="relative z-10 flex items-center justify-center w-14 h-14 rounded-2xl bg-ink-900 border border-white/10 shadow-card">
                  <Icon className="w-6 h-6 text-brand-400" />
                  <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-brand-500 text-[10px] font-bold flex items-center justify-center text-white">
                    {i + 1}
                  </span>
                </div>
                <h3 className="font-semibold text-white">{title}</h3>
                <p className="text-sm text-white/55 max-w-xs">{desc}</p>
              </div>
            ))}
          </div>
          </InView>
        </section>

        {/* MATCHS DU JOUR (aperçu) */}
        <section className="mx-auto max-w-6xl px-4 py-10">
          <InView viewOptions={{ once: true }} once variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white">Pronostics du jour</h2>
              <p className="text-sm text-white/50 mt-0.5">Un aperçu, mis à jour chaque matin.</p>
            </div>
            <Link href="/dashboard" className="text-sm text-brand-400 font-semibold hover:text-brand-300 transition-colors flex items-center gap-1">
              Voir tout <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          </InView>
          <AnimatedGroup preset="blur-slide" className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {DEMO_FIXTURES.slice(0, 3).map((f) => (
              <MatchCard key={f.id} fixture={f} locked={!f.free} />
            ))}
          </AnimatedGroup>
        </section>

        {/* FEATURES */}
        <section className="mx-auto max-w-6xl px-4 py-14">
          <InView viewOptions={{ once: true }} once variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}>
            <div className="text-center mb-10">
              <Badge tone="brand" className="mb-3">Pourquoi KickPredict</Badge>
              <h2 className="text-2xl sm:text-3xl font-bold text-white">Tout ce qu'il faut, rien de superflu</h2>
            </div>
          </InView>
          <AnimatedGroup preset="blur-slide" className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <Card key={title} variant="glow">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 mb-4">
                  <Icon className="w-5 h-5 text-brand-400" />
                </div>
                <h3 className="font-semibold text-white mb-1.5">{title}</h3>
                <p className="text-sm text-white/55 leading-relaxed">{desc}</p>
              </Card>
            ))}
          </AnimatedGroup>
        </section>

        {/* PRICING */}
        <section id="pricing" className="mx-auto max-w-6xl px-4 py-16">
          <InView viewOptions={{ once: true }} once variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}>
            <div className="text-center mb-10">
              <Badge tone="accent" className="mb-3">Tarifs</Badge>
              <h2 className="text-2xl sm:text-3xl font-bold text-white">Un abonnement en FCFA, sans surprise</h2>
              <p className="text-white/55 mt-2 text-sm">Paiement Mobile Money instantané — T-Money & Flooz</p>
            </div>
          </InView>
          <AnimatedGroup preset="slide" className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PLANS.map((p) => (
              <PricingCard key={p.code} plan={p} />
            ))}
          </AnimatedGroup>
        </section>

        {/* WHATSAPP CTA */}
        <section className="mx-auto max-w-4xl px-4 pb-16">
          <Card className="relative overflow-hidden flex flex-col sm:flex-row items-center justify-between gap-5 bg-gradient-to-br from-brand-500/15 via-white/[0.03] to-transparent border-brand-500/25">
            <BorderTrail size={90} />
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-500/15 border border-brand-500/25 shrink-0">
                <MessageCircle className="w-6 h-6 text-brand-400" />
              </div>
              <div>
                <h3 className="font-bold text-white">Recevez les pronostics du jour sur WhatsApp</h3>
                <p className="text-sm text-white/55">Gratuit à l'inscription, sans installer d'application.</p>
              </div>
            </div>
            <Button href={`https://wa.me/${MANUAL_PAYMENT_INFO.whatsappNumber}`} variant="secondary" className="shrink-0">
              Rejoindre sur WhatsApp
            </Button>
          </Card>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-3xl px-4 py-16">
          <div className="text-center mb-10">
            <Badge tone="neutral" className="mb-3">Questions fréquentes</Badge>
            <h2 className="text-2xl sm:text-3xl font-bold text-white">Tout ce que tu dois savoir</h2>
          </div>
          <FAQ />
        </section>

        {/* CTA FINAL */}
        <section className="mx-auto max-w-5xl px-4 pb-16">
          <Card
            variant="glow"
            className="relative overflow-hidden text-center py-14 px-6 bg-gradient-to-br from-brand-500/15 via-ink-900 to-accent-500/10 border-brand-500/25"
          >
            <div className="absolute inset-0 opacity-30 bg-dot-grid [mask-image:radial-gradient(circle,black,transparent_70%)]" aria-hidden />
            <div className="pointer-events-none absolute inset-0 bg-[url(/motifs/cta-blobs.svg)] bg-cover bg-center opacity-80" aria-hidden />
            <BorderTrail size={140} />
            <div className="relative">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
                Prêt à parier plus intelligemment ?
              </h2>
              <p className="text-white/60 max-w-xl mx-auto mb-7 text-sm sm:text-base">
                Rejoins {APP_NAME} et reçois dès aujourd&apos;hui des analyses claires sur les matchs
                d&apos;Afrique et des grands championnats européens.
              </p>
              <Button href="/inscription" size="lg" className="group">
                Essai gratuit 3 jours
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </div>
          </Card>
        </section>

        {/* DISCLAIMER LEGAL */}
        <section className="mx-auto max-w-4xl px-4 pb-16 text-center">
          <p className="text-xs text-white/35 leading-relaxed">
            {APP_NAME} est un service d&apos;analyse statistique et d&apos;information sportive (18+). Nous ne sommes
            ni un bookmaker ni un opérateur de jeux d'argent : nous ne prenons aucun pari et ne garantissons aucun
            gain. Les pronostics sont fournis à titre indicatif. Jouez de manière responsable.{" "}
            <Link href="/legal/cgu" className="underline hover:text-white/60">CGU</Link> ·{" "}
            <Link href="/legal/confidentialite" className="underline hover:text-white/60">Confidentialité</Link>
          </p>
        </section>
      </main>

      <footer className="border-t border-white/[0.08] py-8 text-center text-xs text-white/35">
        © {new Date().getFullYear()} {APP_NAME_FULL} — basé à Lomé, Togo 🇹🇬
      </footer>
    </MotionProvider>
  );
}
