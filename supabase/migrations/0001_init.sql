-- ============================================================================
-- KickPredict Togo — schéma initial (Supabase / PostgreSQL)
-- 10 tables principales + enums + RLS + trigger de création de profil
--
-- Ce script est conçu pour être ré-exécutable sans erreur (création idempotente :
-- IF NOT EXISTS, DO $$ ... EXCEPTION, DROP POLICY/TRIGGER puis CREATE, ON CONFLICT).
-- Si ton projet contenait déjà une table "profiles" issue d'un autre script de
-- démarrage Supabase, exécute d'abord 0000_reset_before_install.sql.
-- ============================================================================

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- ENUMS (création idempotente : ignore l'erreur si le type existe déjà)
-- ---------------------------------------------------------------------------
do $$ begin
  create type user_role as enum ('user', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type subscription_status as enum ('trial', 'active', 'expired', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_status as enum ('pending', 'success', 'failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_method as enum ('tmoney', 'flooz', 'gozem', 'card', 'unknown', 'manual');
exception when duplicate_object then null; end $$;

do $$ begin
  create type fixture_status as enum ('scheduled', 'live', 'finished', 'postponed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type notif_channel as enum ('telegram', 'whatsapp', 'push', 'sms');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 1. PROFILES — étend auth.users (Supabase Auth gère l'OTP téléphone/email)
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  phone text unique,
  full_name text,
  role user_role not null default 'user',
  telegram_chat_id text,
  whatsapp_number text,
  language text not null default 'fr',
  created_at timestamptz not null default now()
);

-- Création automatique du profil à l'inscription
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, phone, full_name)
  values (new.id, new.phone, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 2. PLANS — catalogue d'abonnement (source de vérité des prix)
-- ---------------------------------------------------------------------------
create table if not exists plans (
  id uuid primary key default uuid_generate_v4(),
  code text unique not null, -- 'hebdo' | 'mensuel' | 'trimestriel' | 'annuel'
  name text not null,
  price_fcfa integer not null,
  duration_days integer not null,
  features jsonb not null default '[]',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. SUBSCRIPTIONS
-- ---------------------------------------------------------------------------
create table if not exists subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles (id) on delete cascade,
  plan_code text not null references plans (code),
  status subscription_status not null default 'trial',
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  amount_fcfa integer not null,
  auto_renew boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_subscriptions_user on subscriptions (user_id);
create index if not exists idx_subscriptions_status_ends on subscriptions (status, ends_at);

-- ---------------------------------------------------------------------------
-- 4. PAYMENTS — traçabilité de toutes les tentatives de paiement Mobile Money
-- ---------------------------------------------------------------------------
create table if not exists payments (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles (id) on delete cascade,
  subscription_id uuid references subscriptions (id) on delete set null,
  provider text not null default 'cinetpay', -- 'cinetpay' | 'manual' | 'paydunya' | 'hub2'
  provider_transaction_id text unique not null,
  amount_fcfa integer not null,
  currency text not null default 'XOF',
  status payment_status not null default 'pending',
  payment_method payment_method not null default 'unknown',
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create index if not exists idx_payments_user on payments (user_id);
create index if not exists idx_payments_status on payments (status);

-- ---------------------------------------------------------------------------
-- 5. LEAGUES
-- ---------------------------------------------------------------------------
create table if not exists leagues (
  id uuid primary key default uuid_generate_v4(),
  external_api_id text unique,
  name text not null,
  country text not null,
  priority_order integer not null default 100, -- plus petit = affiché en premier (ligues africaines prioritaires)
  logo_url text,
  avg_goals_per_match numeric(4,2) not null default 2.50,
  active boolean not null default true
);

-- ---------------------------------------------------------------------------
-- 6. TEAMS
-- ---------------------------------------------------------------------------
create table if not exists teams (
  id uuid primary key default uuid_generate_v4(),
  external_api_id text unique,
  league_id uuid references leagues (id) on delete set null,
  name text not null,
  country text,
  logo_url text,
  elo numeric(7,2) not null default 1500,
  attack_rating numeric(5,3) not null default 1.000,
  defense_rating numeric(5,3) not null default 1.000,
  form_points_5 integer not null default 7,
  injuries_impact numeric(4,3) not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists idx_teams_league on teams (league_id);

-- ---------------------------------------------------------------------------
-- 7. FIXTURES (matchs)
-- ---------------------------------------------------------------------------
create table if not exists fixtures (
  id uuid primary key default uuid_generate_v4(),
  external_api_id text unique,
  league_id uuid not null references leagues (id),
  home_team_id uuid not null references teams (id),
  away_team_id uuid not null references teams (id),
  kickoff_at timestamptz not null,
  status fixture_status not null default 'scheduled',
  home_score integer,
  away_score integer,
  odds_home numeric(6,2),
  odds_draw numeric(6,2),
  odds_away numeric(6,2),
  live_stats jsonb, -- possession, xG, tirs cadrés, etc. mis à jour en direct
  created_at timestamptz not null default now()
);

create index if not exists idx_fixtures_kickoff on fixtures (kickoff_at);
create index if not exists idx_fixtures_status on fixtures (status);
create index if not exists idx_fixtures_league on fixtures (league_id);

-- ---------------------------------------------------------------------------
-- 8. PREDICTIONS
-- ---------------------------------------------------------------------------
create table if not exists predictions (
  id uuid primary key default uuid_generate_v4(),
  fixture_id uuid not null references fixtures (id) on delete cascade,
  model_version text not null default 'elo-poisson-v1',
  prob_home numeric(5,4) not null,
  prob_draw numeric(5,4) not null,
  prob_away numeric(5,4) not null,
  prob_over25 numeric(5,4) not null,
  prob_btts_yes numeric(5,4) not null,
  predicted_score_home integer not null,
  predicted_score_away integer not null,
  confidence integer not null check (confidence between 0 and 100),
  explanation_text text not null,
  is_value_bet boolean not null default false,
  value_bet_market text, -- '1', 'X', '2', 'over25', 'btts_yes'...
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (fixture_id, model_version)
);

create index if not exists idx_predictions_fixture on predictions (fixture_id);
create index if not exists idx_predictions_confidence on predictions (confidence desc);

-- ---------------------------------------------------------------------------
-- 9. PREDICTION_RESULTS — suivi de la précision réelle de l'IA (affiché aux users)
-- ---------------------------------------------------------------------------
create table if not exists prediction_results (
  id uuid primary key default uuid_generate_v4(),
  prediction_id uuid not null references predictions (id) on delete cascade,
  actual_home_score integer not null,
  actual_away_score integer not null,
  correct_1x2 boolean not null,
  correct_over25 boolean not null,
  correct_btts boolean not null,
  evaluated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 10. NOTIFICATIONS_LOG
-- ---------------------------------------------------------------------------
create table if not exists notifications_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles (id) on delete cascade,
  channel notif_channel not null,
  message text not null,
  status text not null default 'sent',
  sent_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- SEED DES PLANS PAR DÉFAUT (idempotent : met à jour si déjà présent)
-- ---------------------------------------------------------------------------
insert into plans (code, name, price_fcfa, duration_days, features) values
  ('hebdo', 'Hebdo', 1000, 7, '["Accès illimité 7 jours", "Alertes Telegram"]'),
  ('mensuel', 'Mensuel', 3000, 30, '["Accès illimité", "Analyses détaillées", "Alertes Telegram/WhatsApp", "Mode Value Bet"]'),
  ('trimestriel', 'Trimestriel', 7500, 90, '["Tout Mensuel", "-17% vs mensuel", "Support prioritaire"]'),
  ('annuel', 'Annuel', 25000, 365, '["Tout Trimestriel", "-30% vs mensuel", "2 mois offerts"]')
on conflict (code) do update set
  name = excluded.name,
  price_fcfa = excluded.price_fcfa,
  duration_days = excluded.duration_days,
  features = excluded.features;

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------
alter table profiles enable row level security;
alter table subscriptions enable row level security;
alter table payments enable row level security;
alter table predictions enable row level security;
alter table prediction_results enable row level security;
alter table fixtures enable row level security;
alter table teams enable row level security;
alter table leagues enable row level security;
alter table plans enable row level security;
alter table notifications_log enable row level security;

-- Helper : l'utilisateur courant est-il admin ?
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable;

-- PROFILES : chacun voit/modifie son profil, les admins voient tout
drop policy if exists "profiles_select_own_or_admin" on profiles;
create policy "profiles_select_own_or_admin" on profiles
  for select using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_update_own" on profiles;
create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id);

-- SUBSCRIPTIONS : lecture propre uniquement, écriture réservée au service_role (webhooks)
drop policy if exists "subscriptions_select_own_or_admin" on subscriptions;
create policy "subscriptions_select_own_or_admin" on subscriptions
  for select using (auth.uid() = user_id or public.is_admin());

-- PAYMENTS : lecture propre uniquement
drop policy if exists "payments_select_own_or_admin" on payments;
create policy "payments_select_own_or_admin" on payments
  for select using (auth.uid() = user_id or public.is_admin());

-- DONNÉES PUBLIQUES DE RÉFÉRENCE : lecture libre (même non connecté), écriture admin only
drop policy if exists "leagues_public_read" on leagues;
create policy "leagues_public_read" on leagues for select using (true);
drop policy if exists "leagues_admin_write" on leagues;
create policy "leagues_admin_write" on leagues for all using (public.is_admin());

drop policy if exists "teams_public_read" on teams;
create policy "teams_public_read" on teams for select using (true);
drop policy if exists "teams_admin_write" on teams;
create policy "teams_admin_write" on teams for all using (public.is_admin());

drop policy if exists "fixtures_public_read" on fixtures;
create policy "fixtures_public_read" on fixtures for select using (true);
drop policy if exists "fixtures_admin_write" on fixtures;
create policy "fixtures_admin_write" on fixtures for all using (public.is_admin());

drop policy if exists "plans_public_read" on plans;
create policy "plans_public_read" on plans for select using (active = true or public.is_admin());

-- PREDICTIONS : lecture publique des champs "gratuits" gérée côté application (colonnes
-- sensibles filtrées par l'API selon le statut d'abonnement). En base, lecture ouverte,
-- écriture réservée aux crons (service_role) / admin.
drop policy if exists "predictions_public_read" on predictions;
create policy "predictions_public_read" on predictions for select using (true);
drop policy if exists "predictions_admin_write" on predictions;
create policy "predictions_admin_write" on predictions for all using (public.is_admin());

drop policy if exists "prediction_results_public_read" on prediction_results;
create policy "prediction_results_public_read" on prediction_results for select using (true);

-- NOTIFICATIONS : uniquement visibles par leur destinataire ou un admin
drop policy if exists "notifications_select_own_or_admin" on notifications_log;
create policy "notifications_select_own_or_admin" on notifications_log
  for select using (auth.uid() = user_id or public.is_admin());

-- ============================================================================
-- Note : les INSERT/UPDATE sur subscriptions, payments, predictions depuis les
-- routes API se font avec la clé SUPABASE_SERVICE_ROLE_KEY (bypass RLS), jamais
-- depuis le navigateur. Ne jamais exposer cette clé côté client.
-- ============================================================================
