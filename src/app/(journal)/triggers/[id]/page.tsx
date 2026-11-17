import { notFound } from "next/navigation";
import { TriggerDetail } from "@/components/trigger-detail";
import { getJournal } from "@/lib/server/queries";
export default async function TriggerPage({ params }: {params:Promise<{id:string}>}) { const [data,{id}] = await Promise.all([getJournal(),params]); const trigger = data.triggers.find(t => t.id === id); if (!trigger) notFound(); return <TriggerDetail trigger={trigger} entries={data.entries} timezone={data.profile.timezone} />; }
