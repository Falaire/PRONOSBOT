-- ============================================================================
-- 0006 — Durcissement : idempotence des paiements, unicite des resultats,
-- unites de mesure, garde-fous de valeurs.
-- Issues de la revue du 31/10 (voir REVUE-DEPOT-PRONOSBOT.md), chaque bloc cite
-- la ligne de code ou la mesure qui l'a motive.
--
-- A EXECUTER dans l'ordre, puis redéployer. Les 4 premiers blocs sont sans
-- impact sur le code de lecture ; les blocs 5 et 6 demandent une mise a jour
-- d'ecriture (deja faite cote moteur/routes dans ce patch).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) IDEMPOTENCE DES ABONNEMENTS LIES A UN PAIEMENT
--    Le webhook CinetPay inserait un abonnement par appel ACCEPTED, sans lien
--    unique vers le paiement ni garde sur payments.status -> un transaction_id
--    rejoue = +plan.days de Premium a chaque appel (le transaction_id est
--    renvoye au client par /init, l.56). Le chemin manuel etait correct.
-- ----------------------------------------------------------------------------
alter table subscriptions add column if not exists payment_id uuid references payments (id) on delete set null;

-- Un paiement ne cree qu'un abonnement. Contrainte partielle : les abonnements
-- hors paiement (trial accorde a l'inscription, credits manuels) restent permis.
create unique index if not exists uniq_subscription_per_payment
  on subscriptions (payment_id) where payment_id is not null;

-- ----------------------------------------------------------------------------
-- 2) UN MATCH = UN RESULTAT NOTE
--    prediction_results n'avait aucune unicite sur prediction_id : un re-run du
--    cron de notation dupliquait les lignes, et le taux de reussite affiche au
--    public devenait une fonction du nombre d'executions du cron. La FK non
--    indexee penalisait aussi la jointure du carnet.
-- ----------------------------------------------------------------------------
-- Si la base contient deja des doublons, l'index echoue : decommenter pour les
-- purger (on garde le premier evalute par prediction) AVANT de relancer ce bloc.
-- delete from prediction_results p using (
--   select id, row_number() over (partition by prediction_id order by evaluated_at, id) rn
--   from prediction_results
-- ) d where d.rn > 1 and p.id = d.id;

create unique index if not exists uniq_prediction_result_per_prediction
  on prediction_results (prediction_id);
create index if not exists idx_prediction_results_prediction
  on prediction_results (prediction_id);

-- ----------------------------------------------------------------------------
-- 3) FORME : LAISSER L'ASYMPTOTE ATTEIGNABLE
--    updateFormPoints() (ratings.ts l.57-60) converge vers 15 / 5 / 0 comme
--    l'annonce son commentaire — mais la route ecrivait Math.round() dans une
--    colonne integer, ce qui fige la recursion sur 13 / 7 / 2 (une equipe qui
--    fait nuls sur nuls reste a 7 pour toujours, et 7 -> formFactor 0.9833,
--    jamais 1.00). Mesure d'impact modele : 0.00030 de log-loss — le gain est
--    la coherence, pas la performance.
-- ----------------------------------------------------------------------------
alter table teams alter column form_points_5 type numeric(5,2) using form_points_5::numeric;
alter table teams alter column form_points_5 set default 7.50;

-- ----------------------------------------------------------------------------
-- 4) MOYENNE DE LIGUE : UNE SEULE UNITE (buts par EQUIPE et par match)
--    leagues.avg_goals_per_match etait alimentee en TOTAUX par match (seed :
--    2.2 a 3.1 ; defaut DDL 2.50) alors que le moteur attend une moyenne par
--    equipe. sanitizeLeagueAvg rejette hors [0.8 ; 2.0] : les 11 ligues du seed
--    tombaient donc TOUTES sur le repli 1.35, ce qui effacait tout le signal
--    inter-ligues (un match neutre annonce +2,5 a 57.4 % la ou la moyenne reelle
--    togolaise supposee donnait 46.8 %, et sous-annoncait la Bundesliga de
--    9 points). Desormais la base refuse l'ancien format au lieu de le corriger
--    en silence.
-- ----------------------------------------------------------------------------
-- Conversion des valeurs encore au format "total" (2 executions ne changent
-- rien : la deuxieme ne trouve plus rien au-dessus de 2.0).
update leagues
   set avg_goals_per_match = round(avg_goals_per_match / 2, 2)
 where avg_goals_per_match > 2.0;

comment on column leagues.avg_goals_per_match is
  'Buts marques par EQUIPE et par match dans la ligue (moyenne des deux equipes), pas le total du match. Alimenta MatchContext.leagueAvgGoals ; recalcul par /api/predictions/recalc-league-averages (computeLeagueAvgGoalsPerTeam).';

alter table leagues drop constraint if exists leagues_avg_goals_per_team_range;
alter table leagues add constraint leagues_avg_goals_per_team_range
  check (avg_goals_per_match between 0.8 and 2.0);

-- ----------------------------------------------------------------------------
-- 5) PROBABILITES STOCKEES : DES VALEURS, PAS DES SUGGESTIONS
--    Le carnet stocke des numeric(5,4) sans borne ; le triple 1X2 etait arrondi
--    branche par branche (236 lignes sur 999, soit 23.6 %, ne sommaient pas a
--    1 — corrige cote moteur en derivant la troisieme branche).
-- ----------------------------------------------------------------------------
alter table predictions drop constraint if exists predictions_probs_range;
alter table predictions add constraint predictions_probs_range check (
  prob_home between 0 and 1 and prob_draw between 0 and 1 and prob_away between 0 and 1
  and prob_over25 between 0 and 1 and prob_btts_yes between 0 and 1
);

alter table predictions drop constraint if exists predictions_confidence_range;
alter table predictions add constraint predictions_confidence_range
  check (confidence between 0 and 100);

-- Un value_bet sans marche compare n'a pas de sens : les deux colonnes voyagent ensemble.
alter table predictions drop constraint if exists predictions_value_coherent;
alter table predictions add constraint predictions_value_coherent check (
  is_value_bet = false or (value_bet_market is not null and market_prob_used is not null)
);

-- ----------------------------------------------------------------------------
-- 6) SNAPSHOT DES COTES A L'EMISSION (sans ca, aucun CLV possible)
--    fixtures.odds_* est une ligne vivante reecrite par le cron de synchro : la
--    cote CONTRE LAQUELLE une value a ete decidee n'etait conservee que quand
--    une value etait trouvee (generate/route.ts l.143-148, dans le if (best)).
--    Donc « mon modele battait-il le marche ce jour-la ? » etait inconciliable
--    pour les 3/4 de predictions sans value, et is_value_bet indefendable a
--    posteriori des qu'un bookmaker corrigeait sa cote.
-- ----------------------------------------------------------------------------
create table if not exists prediction_odds (
  prediction_id uuid primary key references predictions (id) on delete cascade,
  odds_home  numeric(6,2),
  odds_draw  numeric(6,2),
  odds_away  numeric(6,2),
  -- Probabilites demi-marginnees AU MOMENT de l'emission : fige aussi la methode
  -- (proportionnelle) si un jour tu passes a un logit-martingale.
  devig_home numeric(5,4),
  devig_draw numeric(5,4),
  devig_away numeric(5,4),
  overround  numeric(5,4),
  odds_over25   numeric(6,2),
  odds_btts_yes numeric(6,2),
  provider   text not null default 'unknown',
  captured_at timestamptz not null default now()
);
alter table prediction_odds enable row level security;
-- JAMAIS public : ce sont les donnees qui rendent le carnet verifiable.
create policy "prediction_odds_admin_write" on prediction_odds
  for all using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- 7) updated_at DE SUBSCRIPTIONS
--    La table declare updated_at not null default now() ; ni le webhook ni
--    l'approbation manuelle ne le re-ecrivaient, donc la colonne restait a la
--    date de creation (aucun temoin du dernier changement pour le support).
-- ----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists touch_subscriptions_updated_at on subscriptions;
create trigger touch_subscriptions_updated_at
  before update on subscriptions
  for each row execute function public.touch_updated_at();
