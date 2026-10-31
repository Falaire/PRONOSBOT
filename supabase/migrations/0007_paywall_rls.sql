-- ============================================================================
-- 0007 — Verrou du paywall cote BASE (FACULTATIF : lire le preambule)
--
-- Etat mesure : AUCUNE fuite constatee sur le site deploye. Le HTML anonyme
-- d'une fiche verrouillee ne contient ni texte d'analyse ni probabilite, et sur
-- les 15 chunks du bundle client : zero occurrence de « supabase », zero token
-- eyJ…, zero URL de projet. Le paywall tient donc cote rendu.
--
-- Mais le verrou n'existe QUE dans le code de la route : RLS autorise
-- `select * from predictions` pour tout cle anon (0001_init.sql l.316,
-- predictions_public_read using (true)). Le jour ou une lecture client
-- (@supabase/supabase-js est dans package.json) expose la table, ou ou un
-- mobile/desktop utilisera la cle anon, `explanation_text`, `predicted_score_*`
-- et `is_value_bet` seront lisibles sans abonnement — soit le contenu a 3 000
-- FCFA/mois. Ce fichier deplace la regle la ou elle est infranchissable.
--
-- PRE-REQUIS APPLICATIF (sinon tu casses le dashboard gratuit) :
--  1. la lecture anonyme doit viser la VUE predictions_public, pas la table ;
--  2. les pages qui affichent deja « Analyse complete reservee a Premium »
--     doivent continuer a passer par un select de la table AVEC session — la
--     policy ci-dessous laisse passer un abonne actif et refuse un gratuit, ce
--     qui rend le message « vide » different d'une erreur : gerer 0 lignes =
--     verrou, pas exception ;
--  3. tester avec un compte gratuit ET un compte expire (ends_at < now).
-- ============================================================================

-- Qui a droit a l'analyse complete : admin, ou abonnement trial/actif non expire.
create or replace function public.has_active_subscription(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from subscriptions s
    where s.user_id = uid
      and s.status in ('trial', 'active')
      and s.ends_at > now()
  );
$$;

revoke execute on function public.has_active_subscription(uuid) from public;
grant execute on function public.has_active_subscription(uuid) to authenticated, service_role;

-- La partie que le gratuit a le droit de voir, en lecture directe.
create or replace view predictions_public as
select
  p.id            as prediction_id,
  p.fixture_id,
  p.model_version,
  p.generated_at,
  p.prob_home,
  p.prob_draw,
  p.prob_away,
  p.prob_over25,
  p.prob_btts_yes,
  p.confidence
from predictions p;

alter view predictions_public owner to postgres;
grant select on public.predictions_public to anon, authenticated, service_role;

-- Le verrou remplace la lecture ouverte de la table.
drop policy if exists "predictions_public_read" on predictions;
create policy "predictions_premium_read" on predictions
  for select using (public.is_admin() or public.has_active_subscription(auth.uid()));

-- prediction_results reste public : c'est le carnet, il doit rester verifiable
-- par tous (c'est ce qui rend l'offre credible) — rien a changer ici.

-- Notification : les colonnes qui ne sortent plus pour un gratuit sont
-- explanation_text, predicted_score_home, predicted_score_away, is_value_bet,
-- value_bet_market, edge_value, data_gaps. Tout ce qui est affiche avant
-- « debloquer » doit passer par predictions_public.
