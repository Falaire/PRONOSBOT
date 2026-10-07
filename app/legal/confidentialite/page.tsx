import { Navbar } from "@/components/Navbar";

export default function ConfidentialitePage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-12">
          <h1 className="text-2xl font-bold text-white mb-4">Politique de confidentialité</h1>
          <div className="space-y-4 text-sm text-white/70 leading-relaxed">
            <p>
              Nous collectons uniquement les données nécessaires au fonctionnement du Service : adresse email
              (authentification), numéro de téléphone si vous le renseignez (alertes WhatsApp, paiement Mobile
              Money), historique d'abonnement et de paiement (via notre prestataire Mobile Money), et données
              d'usage anonymisées.
            </p>
            <p>
              Nous ne vendons aucune donnée personnelle à des tiers. Les données de paiement transitent directement
              par l'agrégateur agréé (CinetPay) et l'opérateur Mobile Money ; KickPredict ne stocke jamais de
              code secret Mobile Money ni d'identifiants opérateur.
            </p>
            <p>
              Vous pouvez demander la suppression de votre compte et de vos données à tout moment via WhatsApp ou par
              email.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
