import { HistoryView } from "@/components/history-view";
import { getJournal } from "@/lib/server/queries";

export default async function HistoryPage() {
  return <HistoryView data={await getJournal()} />;
}
