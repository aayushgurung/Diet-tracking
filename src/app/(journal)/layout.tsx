import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/server/queries";
import { createClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
export default async function JournalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const client = await createClient();
  const { data } = await client.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
  return <AppShell displayName={data?.display_name ?? user.user_metadata?.display_name}>{children}</AppShell>;
}
