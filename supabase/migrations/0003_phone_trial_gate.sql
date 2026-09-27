-- ============================================================================
-- Anti-abus « essai gratuit » : un numéro de téléphone ne peut déclencher qu'UN SEUL essai
-- gratuit, pour toujours (même si le compte lié est supprimé plus tard). Objectif : empêcher
-- de contourner la limite via des adresses email jetables (temp-mail...) en gardant son vrai
-- numéro de téléphone d'un compte à l'autre.
--
-- Volontairement SANS policy RLS pour anon/authenticated : seule la route serveur
-- app/api/account/complete-signup (clé service_role) peut lire/écrire cette table.
-- ============================================================================

create table if not exists trial_phone_ledger (
  phone text primary key,
  user_id uuid references profiles (id) on delete set null,
  claimed_at timestamptz not null default now()
);

alter table trial_phone_ledger enable row level security;
