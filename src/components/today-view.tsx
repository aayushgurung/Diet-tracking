import Link from "next/link";
import { ArrowRight, BookOpen, Flag, Plus, Sprout } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { FoodCard } from "@/components/food-card";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/page-heading";
import { currentDateKey, localDateKey, formatDate } from "@/lib/time";
import type { JournalData } from "@/lib/types";

export function TodayView({ data, saved = false }: { data: JournalData; saved?: boolean }) {
  const { profile, entries, triggers } = data;
  const today = currentDateKey(profile.timezone);
  const activeTriggers = triggers.filter(t => t.is_active).length;
  const todaysEntries = entries.filter(e => localDateKey(e.eaten_at, profile.timezone) === today).sort((a,b) => a.eaten_at.localeCompare(b.eaten_at));
  const greeting = new Intl.DateTimeFormat("en", { timeZone: profile.timezone, hour: "numeric", hourCycle: "h23" }).format(new Date());
  const greetingText = Number(greeting) < 12 ? "Good morning" : Number(greeting) < 18 ? "Good afternoon" : "Good evening";
  return <>
    <PageHeading eyebrow={formatDate(new Date().toISOString(), profile.timezone, "EEEE, d MMMM yyyy")} title={`${greetingText}${profile.display_name ? `, ${profile.display_name}` : ""}.`} description="A little memory of what you ate, and how you felt." action={<span className="privacy-pill"><span /> Just for you</span>} />
    <section className="welcome-card"><div className="welcome-copy"><span className="eyebrow">YOUR EVERYDAY COMPANION</span><h2>One meal.<br />One little moment.</h2><p>{saved ? "Added to your journal! You can return anytime to add a note about how you felt." : "You don’t have to remember it all. Make a little space for your next food memory."}</p><Button asChild><Link href="/add"><Plus size={18} /> Add food <ArrowRight size={17} /></Link></Button></div>{profile.avatar_enabled && <div className="welcome-avatar"><Avatar state={saved ? "happy" : "neutral"} message={saved ? "Added to your journal!" : "Ready to log your next meal?"} /></div>}<span className="hero-leaf hero-leaf-one" /><span className="hero-leaf hero-leaf-two" /></section>
    <div className="journal-columns"><section><div className="section-heading"><div><p className="eyebrow">YOUR DAILY CHAPTER</p><h2>On the menu today <span className="count-bubble">{todaysEntries.length}</span></h2></div><Link href="/history" className="text-link">View history <ArrowRight size={15} /></Link></div>
      {todaysEntries.length ? <div className="food-list">{todaysEntries.map(entry => <FoodCard key={entry.id} entry={entry} timezone={profile.timezone} />)}</div> : <div className="empty-state"><span className="empty-icon"><BookOpen size={30} strokeWidth={1.4} /></span><h3>Your day is a fresh page</h3><p>Nothing logged yet. What did you eat today?</p><Button variant="outline" asChild><Link href="/add"><Plus size={16} /> Log your first food</Link></Button></div>}
      <Link href="/add" className="add-another"><Plus size={18} /> A bite, a sip, a little something…</Link>
    </section><aside className="today-aside"><div className="gentle-note"><span className="note-icon"><Sprout size={23} /></span><p className="eyebrow">A GENTLE REMINDER</p><h3>Curiosity, without judgement.</h3><p>There’s no perfect way to journal. A quick note today can help you remember how you felt tomorrow.</p></div><Link className="watchlist-shortcut" href="/triggers"><span className="watchlist-icon"><Flag size={19} /></span><div><h3>Your trigger watchlist</h3><p>{activeTriggers} {activeTriggers === 1 ? "food" : "foods"} you’re keeping an eye on</p></div><ArrowRight size={18} /></Link><p className="small-disclaimer">Your journal records personal observations, not medical diagnoses.</p></aside></div>
  </>;
}
