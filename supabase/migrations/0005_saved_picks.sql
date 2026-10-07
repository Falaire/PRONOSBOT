-- ============================================================================
-- Carnet de pronostics personnel : permet à chaque utilisateur de garder les matchs qu'il a
-- choisi de suivre/parier, avec un marché préféré, une note libre, et un statut qui peut être
-- renseigné une fois le match terminé.
-- ============================================================================

create table if not exists saved_picks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users (id) on delete cascade,
  fixture_id uuid not null references fixtures (id) on delete cascade,
  -- Marché choisi par l'utilisateur, mêmes codes que predictions.value_bet_market :
  -- '1' | 'X' | '2' | 'over25' | 'btts_yes'. NULL = "je suis juste le match, pas de pari précis".
  chosen_market text,
  -- Bookmaker prévu pour ce pari (id de lib/bookmakers.ts), facultatif.
  bookmaker_id text,
  note text,
  status text not null default 'pending' check (status in ('pending', 'won', 'lost', 'void')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, fixture_id)
);

create index if not exists idx_saved_picks_user on saved_picks (user_id, created_at desc);

alter table saved_picks enable row level security;

-- Chacun ne voit/modifie/supprime que SES propres pronostics enregistrés.
drop policy if exists "saved_picks_own" on saved_picks;
create policy "saved_picks_own" on saved_picks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
