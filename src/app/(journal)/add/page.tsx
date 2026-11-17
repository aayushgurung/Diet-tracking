import { notFound } from "next/navigation";
import { PageHeading } from "@/components/page-heading";
import { FoodForm } from "@/components/food-form";
import { getJournal } from "@/lib/server/queries";
export default async function AddPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const [data,params] = await Promise.all([getJournal(),searchParams]);
  const entry = params.edit ? data.entries.find(e => e.id === params.edit) : undefined;
  if (params.edit && !entry) notFound();
  return <><PageHeading eyebrow="A MOMENT FOR YOURSELF" title={entry ? "Edit your food memory" : "What’s on your plate?"} description="A quick note now. A helpful memory later." /><FoodForm data={data} entry={entry} /></>;
}
