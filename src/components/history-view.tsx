"use client";

import Link from "next/link";
import { useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/page-heading";
import { FoodCard } from "@/components/food-card";
import { currentDateKey, localDateKey } from "@/lib/time";
import type { JournalData } from "@/lib/types";

export function HistoryView({ data }: { data: JournalData }) {
  const today = currentDateKey(data.profile.timezone);
  const [date, setDate] = useState(today);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "flagged" | "unflagged">("all");
  const dayEntries = data.entries.filter((entry) => localDateKey(entry.eaten_at, data.profile.timezone) === date);
  const entries = dayEntries.filter((entry) =>
    entry.food_name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()) &&
    (filter === "all" || (filter === "flagged" ? entry.is_flagged : !entry.is_flagged)),
  ).sort((a, b) => Date.parse(a.eaten_at) - Date.parse(b.eaten_at));

  function moveDate(days: number) {
    // Perform calendar arithmetic at local noon, then keep only the date string.
    // Entry grouping independently uses the profile's timezone.
    setDate(format(addDays(parseISO(`${date}T12:00:00`), days), "yyyy-MM-dd"));
  }

  return <>
    <PageHeading eyebrow="YOUR FOOD MEMORIES" title="A look back." description="The meals you remember, and the little things you noticed." action={<Button asChild><Link href="/add"><Plus size={17} /> Add food</Link></Button>} />
    <section className="history-controls card form-section" aria-label="Filter your journal">
      <div className="history-date-navigation">
        <Button variant="outline" size="icon" aria-label="Previous day" onClick={() => moveDate(-1)}><ChevronLeft size={19} /></Button>
        <div className="field"><label className="label" htmlFor="history-date">Journal date</label><input id="history-date" className="input" type="date" value={date} onChange={(event) => { if (event.target.value) setDate(event.target.value); }} /></div>
        <Button variant="outline" size="icon" aria-label="Next day" onClick={() => moveDate(1)}><ChevronRight size={19} /></Button>
        <Button variant="ghost" onClick={() => setDate(today)} disabled={date === today}>Today</Button>
      </div>
      <div className="history-filters">
        <div className="field"><label className="label" htmlFor="history-search">Search food names on this date</label><div className="search-field"><Search size={17} aria-hidden="true" /><input id="history-search" className="input" type="search" placeholder="Find a food…" value={search} onChange={(event) => setSearch(event.target.value)} /></div></div>
        <div className="field"><label className="label" htmlFor="history-filter">Show</label><select id="history-filter" className="input" value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}><option value="all">All entries</option><option value="flagged">Flagged entries</option><option value="unflagged">Unflagged entries</option></select></div>
      </div>
      <p className="field-help">Dates follow your {data.profile.timezone} timezone and the time you ate.</p>
    </section>
    <section aria-labelledby="history-results-title" className="stack">
      <div className="history-results-heading"><div><p className="eyebrow">{format(parseISO(`${date}T12:00:00`), "EEEE")}</p><h2 id="history-results-title">{format(parseISO(`${date}T12:00:00`), "d MMMM yyyy")}</h2></div><p className="muted" role="status">{entries.length} {entries.length === 1 ? "entry" : "entries"}</p></div>
      {entries.length ? <div className="timeline-list">{entries.map((entry) => <FoodCard key={entry.id} entry={entry} timezone={data.profile.timezone} />)}</div> : <div className="empty-state card"><CalendarDays size={32} strokeWidth={1.4} aria-hidden="true" /><h3>{dayEntries.length ? "No entries match these filters." : "A quiet page in your journal."}</h3><p>{dayEntries.length ? "Try another food name or choose all entries." : "Nothing logged on this date. You can always add a meal you remember."}</p>{dayEntries.length ? <Button variant="outline" onClick={() => { setSearch(""); setFilter("all"); }}>Clear filters</Button> : <Button variant="outline" asChild><Link href="/add">Add a food memory</Link></Button>}</div>}
    </section>
  </>;
}
