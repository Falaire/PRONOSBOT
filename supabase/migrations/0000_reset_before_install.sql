-- ============================================================================
-- KickPredict Togo — script de NETTOYAGE à exécuter UNE SEULE FOIS, AVANT
-- 0001_init.sql, si ton projet Supabase contient déjà une table "profiles"
-- (ou d'autres tables du même nom) provenant du script de démarrage par
-- défaut proposé par Supabase à la création d'un projet.
--
-- ⚠️ Sans danger sur un projet neuf sans données réelles : ce script supprime
-- uniquement les objets qui vont être recréés proprement par 0001_init.sql.
-- Si tu as déjà de vraies données utilisateurs dans une table "profiles"
-- existante, NE PAS exécuter ce script sans les sauvegarder avant.
-- ============================================================================

drop trigger if exists on_auth_user_created on auth.users;

drop table if exists notifications_log cascade;
drop table if exists prediction_results cascade;
drop table if exists predictions cascade;
drop table if exists fixtures cascade;
drop table if exists teams cascade;
drop table if exists leagues cascade;
drop table if exists payments cascade;
drop table if exists subscriptions cascade;
drop table if exists plans cascade;
drop table if exists profiles cascade;

drop function if exists public.is_admin() cascade;
drop function if exists public.handle_new_user() cascade;

drop type if exists notif_channel cascade;
drop type if exists fixture_status cascade;
drop type if exists payment_method cascade;
drop type if exists payment_status cascade;
drop type if exists subscription_status cascade;
drop type if exists user_role cascade;

-- Terminé : ton projet est maintenant "vierge" pour ces objets.
-- Étape suivante : exécute le contenu de 0001_init.sql dans une NOUVELLE requête.
