import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/BottomNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getSavedPicks } from "@/lib/saved-picks";
import { getCurrentUserState } from "@/lib/subscription";
import { CarnetItem } from "./carnet-item";
import { NotebookPen } from "lucide-react";

export default async function CarnetPage() {
  const { userId } = await getCurrentUserState();

  if (!userId) {
    return (
      <>
        <Navbar />
        <main className="flex-1 pb-24">
          <div className="mx-auto max-w-2xl px-4 py-8">
            <h1 className="text-2xl font-bold text-white mb-6">Mon carnet de pronostics</h1>
            <Card className="text-center py-10">
              <p className="text-white/70 mb-4">Connecte-toi pour garder les matchs que tu choisis de suivre.</p>
              <Button href="/connexion">Se connecter</Button>
            </Card>
          </div>
        </main>
        <BottomNav />
      </>
    );
  }

  const picks = await getSavedPicks(userId);
  const upcoming = picks.filter((p) => new Date(p.kickoff).getTime() >= Date.now());
  const past = picks.filter((p) => new Date(p.kickoff).getTime() < Date.now());

  return (
    <>
      <Navbar />
      <main className="flex-1 pb-24">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <h1 className="text-2xl font-bold text-white mb-1">Mon carnet de pronostics</h1>
          <p className="text-sm text-white/60 mb-6">
            Les matchs que tu as choisi de garder sous le coude, avec ton marché préféré et tes notes — depuis
            n'importe quelle fiche match, clique sur « Ajouter à mon carnet ».
          </p>

          {picks.length === 0 ? (
            <Card className="text-center py-12">
              <NotebookPen className="w-8 h-8 text-white/25 mx-auto mb-3" />
              <p className="text-white/70 font-semibold mb-1">Ton carnet est vide pour l'instant</p>
              <p className="text-sm text-white/50 max-w-sm mx-auto mb-4">
                Va sur un match qui t'intéresse et clique sur « Carnet » ou « Ajouter à mon carnet » pour le
                retrouver ici.
              </p>
              <Button href="/dashboard">Voir les pronostics du jour</Button>
            </Card>
          ) : (
            <>
              {upcoming.length > 0 && (
                <section className="mb-8">
                  <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wide mb-3">
                    À venir ({upcoming.length})
                  </h2>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {upcoming.map((p) => (
                      <CarnetItem key={p.id} pick={p} />
                    ))}
                  </div>
                </section>
              )}
              {past.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wide mb-3">
                    Terminés ({past.length})
                  </h2>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {past.map((p) => (
                      <CarnetItem key={p.id} pick={p} />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </main>
      <BottomNav />
    </>
  );
}
