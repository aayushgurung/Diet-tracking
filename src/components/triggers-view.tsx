"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Flag, Search, Sprout } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { PrivatePhoto } from "@/components/private-photo";
import { PageHeading } from "@/components/page-heading";
import { formatDate } from "@/lib/time";
import type { JournalData } from "@/lib/types";

export function TriggersView({ data }: {data:JournalData}) {
  const [search,setSearch] = useState("");
  const [sort,setSort] = useState("recent");
  const [tab,setTab] = useState("active");
  const visible = data.triggers.filter(t => t.is_active === (tab === "active") && [t.display_name,...t.aliases.map(a => a.alias_name)].some(n => n.toLowerCase().includes(search.toLowerCase()))).sort((a,b) => sort === "name" ? a.display_name.localeCompare(b.display_name) : b.last_flagged_at.localeCompare(a.last_flagged_at));
  return <><PageHeading eyebrow="NOTICING YOUR OWN PATTERNS" title="Your trigger foods" description="A personal watchlist, built from the things you’ve noticed." /><section className="review-banner">{data.profile.avatar_enabled && <Avatar state="review" size="sm" message="A little look back can help." />}<div><h2>Your observations matter.</h2><p>These are foods you’ve flagged, not confirmed allergies. Active items give you a reminder when you log them again.</p></div></section><div className="search-bar"><div className="search-input"><Search size={18} /><input className="input" aria-label="Search trigger foods" placeholder="Find a food or alias…" value={search} onChange={e => setSearch(e.target.value)} /></div><select className="input sort-select" aria-label="Sort trigger foods" value={sort} onChange={e => setSort(e.target.value)}><option value="recent">Recently flagged</option><option value="name">Name A–Z</option></select></div><div className="filter-tabs" aria-label="Watchlist status">{["active","archived"].map(value => <button type="button" key={value} className={tab === value ? "selected" : ""} aria-pressed={tab === value} onClick={() => setTab(value)}>{value === "active" ? "Active warnings" : "Archived"}<span>{data.triggers.filter(t => t.is_active === (value === "active")).length}</span></button>)}</div>{visible.length ? <div className="trigger-grid">{visible.map(trigger => {
    const linked = data.entries.filter(e => e.trigger_food_id === trigger.id).sort((a,b) => b.created_at.localeCompare(a.created_at));
    const flagged = linked.filter(e => e.is_flagged);
    const latest = linked.filter(e => e.reaction).sort((a,b) => b.reaction!.updated_at.localeCompare(a.reaction!.updated_at))[0]?.reaction;
    const photo = linked.find(e => e.photo_url)?.photo_url;
    return <Link key={trigger.id} className={`trigger-card card ${trigger.is_active ? "trigger-card-active" : ""}`} href={`/triggers/${trigger.id}`}><div className="trigger-card-header">{photo ? <span className="trigger-photo"><PrivatePhoto key={photo} src={photo} alt={trigger.display_name} loading="lazy" /></span> : <span className="trigger-food-icon"><Flag size={24} strokeWidth={1.5} /></span>}<span className={`badge ${trigger.is_active ? "badge-trigger" : ""}`}>{trigger.is_active ? "Active warning" : "Archived"}</span><ArrowUpRight size={18} className="muted" /></div><h2>{trigger.display_name}</h2><p className="trigger-symptoms">{latest?.symptoms.length ? latest.symptoms.join(" · ") : "No symptoms added"}</p><div className="stats-row"><span><strong>{flagged.length}</strong> flagged {flagged.length === 1 ? "entry" : "entries"}</span><span>Last flagged<br /><strong>{formatDate(trigger.last_flagged_at,data.profile.timezone,"d MMM yyyy")}</strong></span></div><p className="field-help">First flagged {formatDate(trigger.first_flagged_at,data.profile.timezone)}</p>{trigger.notes && <p className="food-notes">{trigger.notes}</p>}</Link>;
  })}</div> : <div className="empty-state"><span className="empty-icon"><Sprout size={32} strokeWidth={1.4} /></span><h2>{search ? "No foods found" : tab === "archived" ? "No archived warnings" : "No foods flagged yet"}</h2><p>{search ? "Try another name or alias." : tab === "archived" ? "Archived warnings stay here, along with their history." : "Foods you mark red will appear here."}</p></div>}<p className="small-disclaimer">Your watchlist records suspected associations. It doesn’t establish what caused a reaction.</p></>;
}
