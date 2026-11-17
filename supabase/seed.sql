-- Optional development samples for an existing, dedicated test account.
-- Set a real test user's UUID in the same SQL session before running:
-- select set_config('app.seed_user_id', 'YOUR_TEST_USER_UUID', false);
-- The Supabase CLI may run this file on reset; without this setting it is a no-op.
do $$
declare
  v_user uuid := nullif(current_setting('app.seed_user_id', true), '')::uuid;
  v_entry uuid;
begin
  if v_user is null then raise notice 'No development seed user configured; skipping samples.'; return; end if;
  if not exists(select 1 from auth.users where id=v_user) then raise exception 'Create the test auth user before seeding.'; end if;
  if exists(select 1 from public.food_entries where user_id=v_user and notes='Development sample — remove freely.') then return; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_user,'role','authenticated')::text,true);
  v_entry := public.save_food_entry(jsonb_build_object(
    'food_name','Milk','eaten_at',now()-interval '2 hours','notes','Development sample — remove freely.',
    'meal_category',null,'photo_path',null,'components','[]'::jsonb));
  perform public.flag_food_entry(jsonb_build_object(
    'food_entry_id',v_entry,'symptoms',jsonb_build_array('Stomach discomfort'),'severity','mild',
    'reaction_at',now()-interval '1 hour','onset_minutes',60,'notes','A fictional personal observation for development.'));
  perform public.save_food_entry(jsonb_build_object(
    'food_name','Avocado toast','eaten_at',now()-interval '30 minutes','notes','Development sample — remove freely.',
    'meal_category','snack','photo_path',null,'components',jsonb_build_array(jsonb_build_object('name','Avocado','kind','ingredient'))));
end $$;
