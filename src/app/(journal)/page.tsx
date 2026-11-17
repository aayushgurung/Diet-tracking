import { TodayView } from "@/components/today-view";
import { getJournal } from "@/lib/server/queries";
export default async function TodayPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const [data, params] = await Promise.all([getJournal(),searchParams]);
  return <TodayView data={data} saved={params.saved === "1"} />;
}
