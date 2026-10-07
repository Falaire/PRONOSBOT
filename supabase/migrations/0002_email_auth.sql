-- ============================================================================
-- Bascule de l'authentification : téléphone+SMS (Twilio) -> email+code OTP
-- (service d'email intégré à Supabase, gratuit, aucun fournisseur externe requis).
--
-- Sans danger à exécuter même si tu as déjà lancé 0001_init.sql : ce script est
-- idempotent (ré-exécutable sans erreur).
-- ============================================================================

alter table profiles add column if not exists email text;

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, phone, full_name)
  values (new.id, new.email, new.phone, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do update set
    email = coalesce(excluded.email, profiles.email),
    phone = coalesce(excluded.phone, profiles.phone);
  return new;
end;
$$ language plpgsql security definer;

-- Le trigger on_auth_user_created (créé par 0001_init.sql) pointe déjà vers cette fonction ;
-- comme on l'a mise à jour "en place" (CREATE OR REPLACE FUNCTION), rien d'autre à faire.
