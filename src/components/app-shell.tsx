"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Flag, History, LockKeyhole, Plus, Settings, Sprout, Sun } from "lucide-react";
import { APP_NAME } from "@/lib/config";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/", label: "Today", icon: Sun },
  { href: "/add", label: "Add food", icon: Plus },
  { href: "/triggers", label: "Trigger foods", icon: Flag },
  { href: "/history", label: "History", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
];

function Brand() {
  return <Link href="/" className="brand" aria-label={`${APP_NAME} home`}><span className="brand-mark"><Sprout size={25} strokeWidth={1.7} aria-hidden="true" /></span><span>{APP_NAME}<small>A little more mindful.</small></span></Link>;
}

export function AppShell({ children, displayName }: { children: ReactNode; displayName?: string }) {
  const pathname = usePathname();
  const initial = displayName?.trim().charAt(0).toLocaleUpperCase() || "J";
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <aside className="sidebar">
        <Brand />
        <p className="sidebar-label">YOUR LITTLE DAILY RITUAL</p>
        <nav className="desktop-nav" aria-label="Main navigation">
          {navigation.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("nav-link", active && "is-active", href === "/add" && "nav-add")}><Icon size={20} strokeWidth={1.7} aria-hidden="true" /><span>{label}</span>{active && <span className="nav-active-dot" />}</Link>;
          })}
        </nav>
        <div className="sidebar-note"><BookOpen size={21} strokeWidth={1.5} aria-hidden="true" /><p>Every meal has a little story.<br /><span>Make room for yours.</span></p><div className="sidebar-note-leaf" aria-hidden="true"><Sprout size={45} strokeWidth={1} /></div></div>
        <div className="sidebar-bottom">
          <p className="privacy-note"><LockKeyhole size={13} aria-hidden="true" /> Your journal. Just for you.</p>
          <Link href="/settings" className="profile-link"><span className="profile-avatar">{initial}</span><span><strong>{displayName || "Your journal"}</strong><small>Personal space</small></span><Settings size={17} strokeWidth={1.6} aria-hidden="true" /></Link>
        </div>
      </aside>
      <header className="mobile-header"><Brand /><Link href="/settings" className="profile-avatar" aria-label="Open settings">{initial}</Link></header>
      <main id="main-content" className="main-content" tabIndex={-1}>{children}</main>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navigation.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("mobile-nav-link", active && "is-active", href === "/add" && "mobile-nav-add")}><span><Icon size={21} strokeWidth={1.8} aria-hidden="true" /></span><small>{label}</small></Link>;
        })}
      </nav>
    </div>
  );
}
