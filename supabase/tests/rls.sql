-- Run as postgres against a disposable Supabase database after migrations.
-- Every fixture is rolled back. Any failed assertion aborts the script.
begin;

insert into auth.users(id, email, raw_user_meta_data) values
 ('11111111-1111-4111-8111-111111111111', 'journal-rls-a@example.test', '{"display_name":"RLS A","timezone":"Australia/Sydney"}'),
 ('22222222-2222-4222-8222-222222222222', 'journal-rls-b@example.test', '{"display_name":"RLS B"}');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

insert into storage.objects(bucket_id,name) values('food-photos','11111111-1111-4111-8111-111111111111/33333333-3333-4333-8333-333333333333.jpg');
insert into public.media_cleanup_jobs(user_id,path,due_at) values('11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111/33333333-3333-4333-8333-333333333333.jpg',now()+interval '1 hour');

select public.save_food_entry('{"id":null,"food_name":"Milk","eaten_at":"2026-11-17T01:30:00Z","notes":"Own entry","meal_category":null,"photo_path":"11111111-1111-4111-8111-111111111111/33333333-3333-4333-8333-333333333333.jpg","components":[{"name":"Milk","kind":"ingredient"}]}'::jsonb);

do $$ declare v_id uuid; v_created timestamptz; v_trigger uuid; v_job uuid; begin
  if (select count(*) from public.profiles) <> 1 then raise exception 'Profile isolation failed'; end if;
  if (select timezone from public.profiles) <> 'Australia/Sydney' then raise exception 'Signup timezone was not preserved'; end if;
  if public.normalise_food_name('  Cow''s--MILK! ') <> 'cow s milk' then raise exception 'Name normalisation failed'; end if;
  if exists(select 1 from public.media_cleanup_jobs) then raise exception 'Saved photo still staged for deletion'; end if;
  insert into public.media_cleanup_jobs(user_id,path) values('11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111/33333333-3333-4333-8333-333333333333.jpg') returning id into v_job;
  if public.claim_media_cleanup(v_job) is not null then raise exception 'Cleanup leased a photograph referenced by a saved entry'; end if;
  select id, created_at into v_id, v_created from public.food_entries limit 1;
  perform public.flag_food_entry(jsonb_build_object('food_entry_id',v_id,'symptoms',jsonb_build_array('Bloating'),'severity','mild','reaction_at',null,'onset_minutes',30,'notes','Personal observation'));
  select trigger_food_id into v_trigger from public.food_entries where id=v_id;
  if not (select is_flagged from public.food_entries where id=v_id) then raise exception 'Entry flag failed'; end if;
  if (select count(*) from public.reaction_reports where food_entry_id=v_id) <> 1 then raise exception 'Reaction creation failed'; end if;
  update public.trigger_foods set is_active=false where id=v_trigger;
  perform public.flag_food_entry(jsonb_build_object('food_entry_id',v_id,'symptoms',jsonb_build_array('Nausea'),'severity','moderate','reaction_at',null,'onset_minutes',60,'notes','Edited observation'));
  if (select is_active from public.trigger_foods where id=v_trigger) then raise exception 'Editing reaction unexpectedly reactivated archived watchlist'; end if;
  if (select count(*) from public.reaction_reports where food_entry_id=v_id) <> 1 then raise exception 'Repeated flag created duplicate reaction'; end if;
  if (select symptoms from public.reaction_reports where food_entry_id=v_id) <> array['Nausea'] then raise exception 'Reaction update failed'; end if;
  update public.food_entries set created_at='2000-01-01', eaten_at='2026-11-16T23:30:00Z' where id=v_id;
  if (select created_at from public.food_entries where id=v_id) <> v_created then raise exception 'created_at was overwritten'; end if;
  if (select eaten_at from public.food_entries where id=v_id) = v_created then raise exception 'eaten_at confused with created_at'; end if;
  perform public.save_trigger_food(jsonb_build_object('id',v_trigger,'display_name','Milk','notes','Watched','aliases',jsonb_build_array('Cow milk')));
end $$;

set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';

do $$ begin
  if (select count(*) from public.profiles) <> 1 then raise exception 'B can read A profile'; end if;
  if exists(select 1 from public.food_entries) then raise exception 'B can read A entries'; end if;
  if exists(select 1 from public.food_components) then raise exception 'B can read A components'; end if;
  if exists(select 1 from public.reaction_reports) then raise exception 'B can read A reactions'; end if;
  if exists(select 1 from public.trigger_foods) then raise exception 'B can read A watchlist'; end if;
  if exists(select 1 from public.trigger_food_aliases) then raise exception 'B can read A aliases'; end if;
  if exists(select 1 from storage.objects where bucket_id='food-photos') then raise exception 'B can read A photo'; end if;
  begin
    insert into storage.objects(bucket_id,name) values('food-photos','11111111-1111-4111-8111-111111111111/44444444-4444-4444-8444-444444444444.jpg');
    raise exception 'Cross-user photo INSERT unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.food_entries(user_id,food_name,normalised_food_name,eaten_at)
      values('11111111-1111-4111-8111-111111111111','Injected','injected',now());
    raise exception 'Cross-user INSERT unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
-- Composite foreign keys block attaching an owned child to another user's row,
-- even if a future application change accidentally supplies the wrong entry ID.
do $$ declare v_id uuid; begin
  select id into v_id from public.food_entries where user_id='11111111-1111-4111-8111-111111111111' limit 1;
  begin
    insert into public.food_components(user_id,food_entry_id,name,kind)
    values('22222222-2222-4222-8222-222222222222',v_id,'Injected','food');
    raise exception 'Cross-user relationship unexpectedly succeeded';
  exception when foreign_key_violation then null; end;
end $$;

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
do $$ declare v_id uuid; begin
  select id into v_id from public.food_entries limit 1;
  perform public.delete_food_entry(v_id);
  if exists(select 1 from public.food_entries) or exists(select 1 from public.reaction_reports) or exists(select 1 from public.food_components) then raise exception 'Entry cleanup failed'; end if;
  if not exists(select 1 from public.trigger_foods) then raise exception 'Deleting entry erased watchlist'; end if;
  if not exists(select 1 from public.media_cleanup_jobs where path='11111111-1111-4111-8111-111111111111/33333333-3333-4333-8333-333333333333.jpg') then raise exception 'Photo cleanup intent was lost'; end if;
  if public.claim_media_cleanup((select id from public.media_cleanup_jobs limit 1)) is null then raise exception 'Due photo cleanup could not be leased'; end if;
end $$;

reset role;
set local role anon;
do $$ begin
  begin
    perform 1 from public.food_entries;
    raise exception 'Anonymous access unexpectedly allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role service_role;
set local request.jwt.claims = '{"role":"service_role"}';
do $$ begin
  if (select count(*) from public.media_cleanup_jobs) <> 1 then raise exception 'Service cleanup role cannot read jobs'; end if;
  if public.claim_media_cleanup((select id from public.media_cleanup_jobs limit 1)) is null then raise exception 'Service cleanup role cannot lease jobs'; end if;
end $$;
reset role;

rollback;
