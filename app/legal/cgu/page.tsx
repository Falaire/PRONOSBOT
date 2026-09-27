import { Navbar } from "@/components/Navbar";

export default function CguPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-12 prose prose-invert prose-sm">
          <h1 className="text-2xl font-bold text-white mb-4">Conditions Générales d'Utilisation</h1>
          <div className="space-y-4 text-sm text-white/70 leading-relaxed">
            <p>
              <strong>1. Objet.</strong> KickPredict Togo (« le Service ») fournit des analyses statistiques et des
              pronostics sportifs à titre informatif, générés par un modèle algorithmique (Elo + Poisson) à partir de
              données publiques (classements, statistiques d'équipes et de joueurs, historiques de confrontations).
            </p>
            <p>
              <strong>2. Nature du service — ce que nous ne sommes pas.</strong> KickPredict Togo n'est ni un
              bookmaker, ni un opérateur de paris sportifs, ni un intermédiaire de jeu d'argent. Le Service ne
              collecte, ne place et ne gère aucune mise ; il ne reverse aucun gain. Les sommes payées par
              l'utilisateur correspondent exclusivement à un abonnement d'accès à du contenu d'analyse sportive.
              Toute mise éventuelle est effectuée par l'utilisateur, de sa propre initiative, auprès d'un opérateur
              de paris tiers agréé, en dehors de KickPredict Togo.
            </p>
            <p>
              <strong>3. Âge minimum.</strong> Le Service est réservé aux personnes majeures (18 ans et plus).
            </p>
            <p>
              <strong>4. Absence de garantie de résultat.</strong> Les pronostics sont des estimations probabilistes
              et ne garantissent aucun résultat sportif ni aucun gain financier. L'utilisateur reste seul responsable
              de toute décision prise sur la base des informations fournies.
            </p>
            <p>
              <strong>5. Abonnement et paiement.</strong> Les abonnements sont payables en FCFA via Mobile Money
              (T-Money, Flooz). L'accès premium est activé automatiquement après confirmation du paiement par
              l'opérateur. Aucun remboursement n'est possible après activation, sauf erreur technique avérée.
            </p>
            <p>
              <strong>6. Résiliation.</strong> L'utilisateur peut résilier son abonnement à tout moment ; l'accès
              premium reste valable jusqu'à la fin de la période déjà payée.
            </p>
            <p>
              <strong>7. Jeu responsable.</strong> Si vous pariez auprès d'un opérateur tiers, faites-le de manière
              responsable et dans la limite de vos moyens. En cas de difficulté, rapprochez-vous des structures
              d'aide locales.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
