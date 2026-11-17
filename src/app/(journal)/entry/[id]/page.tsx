import { notFound } from "next/navigation";
import { EntryDetail } from "@/components/entry-detail";
import { getJournal } from "@/lib/server/queries";
export default async function EntryPage({ params }: {params:Promise<{id:string}>}) { const [data,{id}] = await Promise.all([getJournal(),params]); const entry = data.entries.find(e => e.id === id); if (!entry) notFound(); return <EntryDetail entry={entry} timezone={data.profile.timezone} trigger={data.triggers.find(t => t.id === entry.trigger_food_id)} />; }
