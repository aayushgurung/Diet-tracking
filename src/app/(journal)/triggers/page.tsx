import { TriggersView } from "@/components/triggers-view";
import { getJournal } from "@/lib/server/queries";
export default async function TriggersPage() { return <TriggersView data={await getJournal()} />; }
