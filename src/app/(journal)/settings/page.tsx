import { SettingsForm } from "@/components/settings-form";
import { getJournal, requireUser } from "@/lib/server/queries";

export default async function SettingsPage() {
  const [data, user] = await Promise.all([getJournal(), requireUser()]);
  return <SettingsForm profile={data.profile} email={user.email ?? ""} accountDeletionEnabled={!!process.env.SUPABASE_SERVICE_ROLE_KEY} />;
}
