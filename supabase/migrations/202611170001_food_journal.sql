-- Run once using `supabase db push` or the Supabase SQL editor.
create extension if not exists pgcrypto;

create function public.normalise_food_name(value text) returns text
language sql immutable strict set search_path = public
as $$ select trim(regexp_replace(lower(normalize(value, NFKC)), '[^[:alnum:]]+', ' ', 'g')); $$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (length(display_name) <= 80),
  timezone text not null default 'UTC' check (length(timezone) between 1 and 100),
  warnings_enabled boolean not null default true,
  avatar_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trigger_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 1 and 160),
  normalised_name text not null check (length(normalised_name) > 0),
  is_active boolean not null default true,
  notes text check (length(notes) <= 5000),
  first_flagged_at timestamptz not null default now(),
  last_flagged_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, normalised_name),
  unique (id, user_id)
);

create table public.food_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  food_name text not null check (length(trim(food_name)) between 1 and 160),
  normalised_food_name text not null check (length(normalised_food_name) > 0),
  eaten_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  notes text check (length(notes) <= 5000),
  meal_category text check (meal_category in ('breakfast', 'lunch', 'dinner', 'snack')),
  photo_path text unique check (photo_path is null or (split_part(photo_path, '/', 1) = user_id::text and photo_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$')),
  is_flagged boolean not null default false,
  trigger_food_id uuid,
  unique (id, user_id),
  foreign key (trigger_food_id, user_id) references public.trigger_foods(id, user_id)
);

create table public.food_components (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  food_entry_id uuid not null,
  name text not null check (length(trim(name)) between 1 and 160),
  kind text not null check (kind in ('food', 'ingredient')),
  foreign key (food_entry_id, user_id) references public.food_entries(id, user_id) on delete cascade
);

create table public.reaction_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  food_entry_id uuid not null unique,
  symptoms text[] not null default '{}' check (cardinality(symptoms) <= 20),
  severity text check (severity in ('mild', 'moderate', 'severe')),
  reaction_at timestamptz,
  onset_minutes integer check (onset_minutes between 0 and 525600),
  notes text check (length(notes) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (food_entry_id, user_id) references public.food_entries(id, user_id) on delete cascade
);

create table public.trigger_food_aliases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trigger_food_id uuid not null,
  alias_name text not null check (length(trim(alias_name)) between 1 and 160),
  normalised_alias_name text not null check (length(normalised_alias_name) > 0),
  unique (user_id, normalised_alias_name),
  foreign key (trigger_food_id, user_id) references public.trigger_foods(id, user_id) on delete cascade
);

-- Replaced/deleted image cleanup is durable: storage and PostgreSQL cannot share
-- one transaction. Failed storage removals are retried after later mutations.
create table public.media_cleanup_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  path text not null check (split_part(path, '/', 1) = user_id::text),
  due_at timestamptz not null default now(),
  cleanup_started boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, path)
);

create index food_entries_user_eaten_idx on public.food_entries(user_id, eaten_at desc, id);
create index food_entries_trigger_idx on public.food_entries(user_id, trigger_food_id) where is_flagged;
create index food_components_entry_idx on public.food_components(user_id, food_entry_id);
create index reaction_reports_user_idx on public.reaction_reports(user_id, food_entry_id);
create index trigger_foods_active_idx on public.trigger_foods(user_id, is_active, last_flagged_at desc);
create index trigger_aliases_trigger_idx on public.trigger_food_aliases(user_id, trigger_food_id);

create function public.stamp_row() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := clock_timestamp();
  if tg_table_name in ('profiles', 'food_entries', 'reaction_reports') then
    if tg_op = 'INSERT' then new.created_at := clock_timestamp();
    else new.created_at := old.created_at; end if;
  end if;
  if tg_table_name = 'food_entries' then new.normalised_food_name := public.normalise_food_name(new.food_name); end if;
  if tg_table_name = 'trigger_foods' then
    new.normalised_name := public.normalise_food_name(new.display_name);
    if tg_op = 'UPDATE' then new.first_flagged_at := old.first_flagged_at; end if;
  end if;
  return new;
end; $$;

create trigger stamp_profiles before insert or update on public.profiles for each row execute function public.stamp_row();
create trigger stamp_food_entries before insert or update on public.food_entries for each row execute function public.stamp_row();
create trigger stamp_reactions before insert or update on public.reaction_reports for each row execute function public.stamp_row();
create trigger stamp_triggers before insert or update on public.trigger_foods for each row execute function public.stamp_row();

create function public.normalise_alias() returns trigger language plpgsql set search_path = public as $$
begin new.normalised_alias_name := public.normalise_food_name(new.alias_name); return new; end; $$;
create trigger normalise_alias before insert or update on public.trigger_food_aliases for each row execute function public.normalise_alias();

create function public.create_profile_for_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, display_name, timezone)
  values (new.id, left(coalesce(new.raw_user_meta_data->>'display_name', ''), 80),
    case when exists(select 1 from pg_timezone_names where name=new.raw_user_meta_data->>'timezone')
    then new.raw_user_meta_data->>'timezone' else 'UTC' end);
  return new;
end; $$;
create trigger create_profile after insert on auth.users for each row execute function public.create_profile_for_user();

-- Backfill profiles if installing into a Supabase project with existing users.
insert into public.profiles(id, display_name)
select id, left(coalesce(raw_user_meta_data->>'display_name', ''), 80) from auth.users
on conflict (id) do nothing;

do $$ declare table_name text; begin
  foreach table_name in array array['profiles','food_entries','food_components','reaction_reports','trigger_foods','trigger_food_aliases','media_cleanup_jobs'] loop
    execute format('alter table public.%I enable row level security', table_name);
    if table_name = 'profiles' then
      execute format('create policy own_rows on public.%I for all to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id)', table_name);
    else
      execute format('create policy own_rows on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', table_name);
    end if;
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
    execute format('grant select, insert, update, delete on public.%I to service_role', table_name);
    execute format('revoke all on public.%I from anon', table_name);
  end loop;
end $$;

-- Security invoker RPCs run under the caller's RLS policies. Every related row
-- also has a composite owner FK, preventing cross-user relationship injection.
create function public.save_food_entry(p_input jsonb) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_id uuid := coalesce((p_input->>'id')::uuid, gen_random_uuid());
  v_old_path text;
  v_path text := nullif(p_input->>'photo_path', '');
  v_component jsonb;
begin
  if v_user is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if length(trim(p_input->>'food_name')) not between 1 and 160
     or jsonb_typeof(p_input->'components') <> 'array'
     or jsonb_array_length(p_input->'components') > 40 then raise exception 'Invalid food details'; end if;
  if v_path is not null and not exists (select 1 from storage.objects where bucket_id='food-photos' and name=v_path and split_part(name,'/',1)=v_user::text) then
    raise exception 'Photograph not found';
  end if;
  if p_input->>'id' is not null then
    select photo_path into v_old_path from public.food_entries where id=v_id and user_id=v_user for update;
    if not found then raise exception 'Entry not found' using errcode='42501'; end if;
    update public.food_entries set food_name=trim(p_input->>'food_name'), eaten_at=(p_input->>'eaten_at')::timestamptz,
      notes=nullif(p_input->>'notes',''), meal_category=nullif(p_input->>'meal_category',''), photo_path=v_path
      where id=v_id and user_id=v_user;
  else
    insert into public.food_entries(id,user_id,food_name,normalised_food_name,eaten_at,notes,meal_category,photo_path)
      values(v_id,v_user,trim(p_input->>'food_name'),public.normalise_food_name(p_input->>'food_name'),(p_input->>'eaten_at')::timestamptz,
      nullif(p_input->>'notes',''),nullif(p_input->>'meal_category',''),v_path);
  end if;
  if v_path is not null and v_path is distinct from v_old_path then
    perform 1 from public.media_cleanup_jobs where user_id=v_user and path=v_path
      and cleanup_started=false and due_at>now() for update;
    if not found then raise exception 'Photo upload expired. Please upload it again.'; end if;
  end if;
  delete from public.food_components where food_entry_id=v_id and user_id=v_user;
  for v_component in select value from jsonb_array_elements(p_input->'components') loop
    insert into public.food_components(user_id,food_entry_id,name,kind)
      values(v_user,v_id,trim(v_component->>'name'),v_component->>'kind');
  end loop;
  if v_old_path is not null and v_old_path is distinct from v_path then
    insert into public.media_cleanup_jobs(user_id,path) values(v_user,v_old_path) on conflict do nothing;
  end if;
  if v_path is not null then delete from public.media_cleanup_jobs where user_id=v_user and path=v_path; end if;
  return v_id;
end; $$;

create function public.flag_food_entry(p_input jsonb) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_entry public.food_entries%rowtype;
  v_trigger uuid;
  v_symptoms text[];
begin
  if v_user is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select * into v_entry from public.food_entries where id=(p_input->>'food_entry_id')::uuid and user_id=v_user for update;
  if not found then raise exception 'Entry not found' using errcode='42501'; end if;
  if jsonb_typeof(p_input->'symptoms') <> 'array' or jsonb_array_length(p_input->'symptoms') > 20 then raise exception 'Invalid symptoms'; end if;
  select coalesce(array_agg(trim(value)), '{}'::text[]) into v_symptoms from jsonb_array_elements_text(p_input->'symptoms');
  if exists(select 1 from unnest(v_symptoms) s where length(s) not between 1 and 100) then raise exception 'Invalid symptom'; end if;
  v_trigger := v_entry.trigger_food_id;
  if v_trigger is null then
    select t.id into v_trigger from public.trigger_foods t
    where t.user_id=v_user and (t.normalised_name=v_entry.normalised_food_name or exists (
      select 1 from public.trigger_food_aliases a where a.trigger_food_id=t.id and a.user_id=v_user and a.normalised_alias_name=v_entry.normalised_food_name
    )) order by t.id limit 1;
  end if;
  if v_trigger is null then
    insert into public.trigger_foods(user_id,display_name,normalised_name)
      values(v_user,v_entry.food_name,v_entry.normalised_food_name)
      on conflict (user_id,normalised_name) do update set is_active=case when v_entry.is_flagged then public.trigger_foods.is_active else true end,
      last_flagged_at=case when v_entry.is_flagged then public.trigger_foods.last_flagged_at else now() end
      returning id into v_trigger;
  else
    update public.trigger_foods set is_active=case when v_entry.is_flagged then is_active else true end,
      last_flagged_at=case when v_entry.is_flagged then last_flagged_at else now() end
      where id=v_trigger and user_id=v_user;
  end if;
  update public.food_entries set is_flagged=true,trigger_food_id=v_trigger where id=v_entry.id and user_id=v_user;
  insert into public.reaction_reports(user_id,food_entry_id,symptoms,severity,reaction_at,onset_minutes,notes)
    values(v_user,v_entry.id,v_symptoms,nullif(p_input->>'severity',''),nullif(p_input->>'reaction_at','')::timestamptz,
      nullif(p_input->>'onset_minutes','')::integer,nullif(p_input->>'notes',''))
    on conflict (food_entry_id) do update set symptoms=excluded.symptoms,severity=excluded.severity,
      reaction_at=excluded.reaction_at,onset_minutes=excluded.onset_minutes,notes=excluded.notes;
  return v_trigger;
end; $$;

create function public.save_trigger_food(p_input jsonb) returns void
language plpgsql security invoker set search_path = public as $$
declare v_user uuid := auth.uid(); v_id uuid := (p_input->>'id')::uuid; v_alias text;
begin
  if v_user is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if jsonb_typeof(p_input->'aliases') <> 'array' or jsonb_array_length(p_input->'aliases') > 30 then raise exception 'Invalid aliases'; end if;
  perform 1 from public.trigger_foods where id=v_id and user_id=v_user for update;
  if not found then raise exception 'Watchlist item not found' using errcode='42501'; end if;
  update public.trigger_foods set display_name=trim(p_input->>'display_name'),notes=nullif(p_input->>'notes','') where id=v_id and user_id=v_user;
  delete from public.trigger_food_aliases where trigger_food_id=v_id and user_id=v_user;
  for v_alias in select value from jsonb_array_elements_text(p_input->'aliases') loop
    insert into public.trigger_food_aliases(user_id,trigger_food_id,alias_name,normalised_alias_name)
      values(v_user,v_id,trim(v_alias),public.normalise_food_name(v_alias));
  end loop;
end; $$;

create function public.delete_food_entry(p_id uuid) returns void
language plpgsql security invoker set search_path = public as $$
declare v_user uuid := auth.uid(); v_path text;
begin
  if v_user is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select photo_path into v_path from public.food_entries where id=p_id and user_id=v_user for update;
  if not found then raise exception 'Entry not found' using errcode='42501'; end if;
  if v_path is not null then insert into public.media_cleanup_jobs(user_id,path) values(v_user,v_path) on conflict do nothing; end if;
  delete from public.food_entries where id=p_id and user_id=v_user;
end; $$;

-- Lease a due cleanup job while holding its row lock. Adoption of a fresh upload
-- takes the same lock; an upload already leased/expired can no longer be saved.
create function public.claim_media_cleanup(p_id uuid) returns text
language plpgsql security invoker set search_path = public as $$
declare v_job public.media_cleanup_jobs%rowtype;
begin
  select * into v_job from public.media_cleanup_jobs where id=p_id and due_at<=now() for update;
  if not found then return null; end if;
  if exists(select 1 from public.food_entries where user_id=v_job.user_id and photo_path=v_job.path) then
    delete from public.media_cleanup_jobs where id=p_id;
    return null;
  end if;
  update public.media_cleanup_jobs set cleanup_started=true where id=p_id;
  return v_job.path;
end; $$;

revoke all on function public.save_food_entry(jsonb), public.flag_food_entry(jsonb), public.save_trigger_food(jsonb), public.delete_food_entry(uuid) from public, anon;
grant execute on function public.save_food_entry(jsonb), public.flag_food_entry(jsonb), public.save_trigger_food(jsonb), public.delete_food_entry(uuid) to authenticated;
revoke all on function public.create_profile_for_user() from public, anon, authenticated;
revoke all on function public.claim_media_cleanup(uuid) from public, anon;
grant execute on function public.claim_media_cleanup(uuid) to authenticated, service_role;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('food-photos','food-photos',false,10485760,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy own_food_photo_select on storage.objects for select to authenticated
  using (bucket_id='food-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy own_food_photo_insert on storage.objects for insert to authenticated
  with check (bucket_id='food-photos' and (storage.foldername(name))[1]=(select auth.uid())::text
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$');
create policy own_food_photo_update on storage.objects for update to authenticated
  using (bucket_id='food-photos' and (storage.foldername(name))[1]=(select auth.uid())::text)
  with check (bucket_id='food-photos' and (storage.foldername(name))[1]=(select auth.uid())::text
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$');
create policy own_food_photo_delete on storage.objects for delete to authenticated
  using (bucket_id='food-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
