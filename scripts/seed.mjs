import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { subDays } from "date-fns";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const { NEXT_PUBLIC_SUPABASE_URL: url, SEED_EMAIL: email, SEED_PASSWORD: password, SEED_CONFIRM: confirmation } = process.env;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key || !email || !password || confirmation !== "DEVELOPMENT") {
  console.error("Use a disposable development account. Set SEED_EMAIL, SEED_PASSWORD and SEED_CONFIRM=DEVELOPMENT in your shell, plus the Supabase variables in .env.local.");
  process.exit(1);
}

const client = createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
try {
  const { data, error } = await client.auth.signInWithPassword({email,password});
  if (error || !data.user) throw new Error("Couldn't sign in to the development account. Check the seed credentials and email confirmation.");
  const {data:profile,error:profileError}=await client.from("profiles").select("timezone").eq("id",data.user.id).single();
  if(profileError) throw new Error("Apply the database migration before seeding.");
  const today=formatInTimeZone(new Date(),profile.timezone,"yyyy-MM-dd");
  const yesterday=formatInTimeZone(subDays(new Date(),1),profile.timezone,"yyyy-MM-dd");
  const samples=[
    {name:"Avocado toast",date:today,time:"08:30",meal:"breakfast",notes:"Development sample · Toast, avocado and a little lemon.",components:[{name:"Avocado",kind:"ingredient"},{name:"Bread",kind:"ingredient"}]},
    {name:"Roasted vegetable bowl",date:today,time:"12:45",meal:"lunch",notes:"Development sample · A quiet lunch at home.",components:[]},
    {name:"Milk",date:yesterday,time:"15:30",meal:"snack",notes:"Development sample · A food to keep an eye on.",components:[]}
  ];
  for(const sample of samples){
    const {data:existing}=await client.from("food_entries").select("id").eq("food_name",sample.name).eq("notes",sample.notes).limit(1);
    if(existing?.length) continue;
    const {data:id,error}=await client.rpc("save_food_entry",{p_input:{food_name:sample.name,eaten_at:fromZonedTime(`${sample.date}T${sample.time}`,profile.timezone).toISOString(),meal_category:sample.meal,notes:sample.notes,photo_path:null,components:sample.components}});
    if(error||!id)throw new Error("Couldn't save a development sample. Check the migration and database policies.");
    if(sample.name==="Milk"){
      const {error}=await client.rpc("flag_food_entry",{p_input:{food_entry_id:id,symptoms:["Stomach discomfort"],severity:"mild",reaction_at:fromZonedTime(`${yesterday}T16:00`,profile.timezone).toISOString(),onset_minutes:30,notes:"Development sample · A personal observation to review, not a confirmed cause."}});
      if(error)throw new Error("Sample saved, but its reaction couldn't be recorded. Check the migration.");
    }
  }
  console.log("Development samples added to your dedicated account. Try typing Milk on Add Food to see its previous-observation warning.");
} catch(error){console.error(error instanceof Error?error.message:"Development seed failed.");process.exitCode=1;}
finally{await client.auth.signOut();}
