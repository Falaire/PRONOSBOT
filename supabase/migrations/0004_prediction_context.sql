-- ============================================================================
-- Enrichissement du moteur de pronostics : Dixon-Coles + contexte par match
-- (H2H, cotes Over/Under & BTTS, enjeu, suivi des ratings déjà appliqués).
-- ============================================================================

-- Marque si un match terminé a déjà servi à mettre à jour les ratings (elo/attaque/défense/
-- forme) des deux équipes, pour ne jamais appliquer deux fois le même résultat.
alter table fixtures add column if not exists ratings_applied boolean not null default false;

-- Cotes réelles pour les marchés Over/Under 2.5 buts et "Les deux équipes marquent" (BTTS),
-- en plus des cotes 1X2 déjà stockées — récupérées depuis la même réponse /odds que le 1X2,
-- donc sans appel API supplémentaire.
alter table fixtures add column if not exists odds_over25 numeric(6,2);
alter table fixtures add column if not exists odds_btts_yes numeric(6,2);

-- Résumé des confrontations directes (H2H) le cas échéant, pondéré faiblement dans le modèle
-- (voir lib/prediction/engine.ts) — NULL si pas assez de données pour être fiable.
alter table fixtures add column if not exists h2h_home_win_rate numeric(4,3);
alter table fixtures add column if not exists h2h_sample_size integer;

-- Note courte sur l'enjeu du match (course au titre / maintien / dead rubber...), affichée dans
-- l'explication IA mais PAS utilisée comme ajustement numérique de probabilité (trop incertain
-- pour être quantifié sans inventer un chiffre arbitraire).
alter table fixtures add column if not exists stakes_note text;

create index if not exists idx_fixtures_ratings_applied on fixtures (status, ratings_applied);

-- Edge (écart proba modèle - proba marché dé-margée) exposé tel quel côté UI, pour éviter de
-- recalculer côté client et pour garder une trace de la proba marché réellement utilisée.
alter table predictions add column if not exists edge_value numeric(5,4);
alter table predictions add column if not exists market_prob_used numeric(5,4);
-- Liste (texte, séparée par " | ") des manques de données identifiés pour ce match, pour affichage
-- direct dans l'UI sans reparser explanation_text.
alter table predictions add column if not exists data_gaps text;
