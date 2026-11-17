"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Check, Download, Flag, Globe2, LoaderCircle, LogOut, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PageHeading } from "@/components/page-heading";
import { profileInputSchema } from "@/lib/schemas";
import { saveProfile, signOut } from "@/lib/server/actions";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";
import type { Profile } from "@/lib/types";

const COMMON_ZONES = ["UTC", "Australia/Sydney", "Australia/Melbourne", "Australia/Brisbane", "Australia/Perth", "Pacific/Auckland", "Asia/Kathmandu", "Asia/Kolkata", "Asia/Singapore", "Europe/London", "America/New_York", "America/Los_Angeles"];

function SignOutButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" variant="outline" disabled={pending}>{pending ? <LoaderCircle className="spin" size={16} /> : <LogOut size={16} />}{pending ? "Signing out…" : "Sign out"}</Button>;
}

export function SettingsForm({ profile, email, accountDeletionEnabled }: { profile: Profile; email: string; accountDeletionEnabled: boolean }) {
  const router = useRouter();
  const [name, setName] = useState(profile.display_name);
  const [timezone, setTimezone] = useState(profile.timezone);
  const [zones, setZones] = useState(() => [...new Set([profile.timezone, ...COMMON_ZONES])]);
  const [warnings, setWarnings] = useState(profile.warnings_enabled);
  const [avatar, setAvatar] = useState(profile.avatar_enabled);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const saving = useRef(false);
  useUnsavedChanges(dirty);

  const [deletionOpen, setDeletionOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deletionError, setDeletionError] = useState("");
  const deletingRef = useRef(false);

  function changed() { setDirty(true); setSaved(false); }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current) return;
    setError(""); setSaved(false); setFieldErrors({});
    const parsed = profileInputSchema.safeParse({ display_name: name, timezone, warnings_enabled: warnings, avatar_enabled: avatar });
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) errors[String(issue.path[0])] = issue.message;
      setFieldErrors(errors); return;
    }
    saving.current = true; setBusy(true);
    try {
      const result = await saveProfile(parsed.data);
      if (!result.success) throw new Error(result.error);
      setDirty(false); setSaved(true); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Your preferences couldn't be saved. Please try again."); }
    finally { saving.current = false; setBusy(false); }
  }

  async function deleteAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (deletingRef.current || !accountDeletionEnabled) return;
    setDeletionError("");
    if (!password || confirmation !== "DELETE") { setDeletionError("Enter your password and type DELETE to confirm."); return; }
    deletingRef.current = true; setDeleting(true);
    try {
      const response = await fetch("/api/account", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password, confirmation }) });
      const result = await response.json();
      if (!response.ok || result.success !== true) throw new Error(result.error ?? "Your account couldn't be deleted. Please try again.");
      setDirty(false); setPassword(""); setDeletionOpen(false);
      router.replace("/login?deleted=1"); router.refresh();
    } catch (cause) { setDeletionError(cause instanceof Error ? cause.message : "Your account couldn't be deleted. Please try again."); }
    finally { deletingRef.current = false; setDeleting(false); }
  }

  return <>
    <PageHeading eyebrow="MAKE YOURSELF AT HOME" title="Your little preferences." description="A journal that fits the way you remember things." />
    <div className="settings-grid">
      <form className="stack" onSubmit={submit} onChange={changed} noValidate aria-busy={busy}>
        <section className="settings-section card form-section"><h2>A little about you</h2><div className="field"><label className="label" htmlFor="profile-name">Name or nickname</label><input id="profile-name" className="input" autoComplete="nickname" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} disabled={busy} aria-invalid={!!fieldErrors.display_name} aria-describedby={fieldErrors.display_name ? "profile-name-error" : undefined} placeholder="What should we call you?" />{fieldErrors.display_name && <p id="profile-name-error" className="form-error">{fieldErrors.display_name}</p>}</div><div className="field"><label className="label" htmlFor="profile-timezone">Your timezone</label><input id="profile-timezone" list="timezone-options" className="input" value={timezone} onChange={(event) => setTimezone(event.target.value)} onFocus={() => { if (typeof Intl.supportedValuesOf === "function") setZones([...new Set([timezone, "UTC", ...Intl.supportedValuesOf("timeZone")])]); }} disabled={busy} aria-invalid={!!fieldErrors.timezone} aria-describedby="timezone-help" autoComplete="off" /><datalist id="timezone-options">{zones.map((zone) => <option key={zone} value={zone} />)}</datalist><p id="timezone-help" className={fieldErrors.timezone ? "form-error" : "field-help"}>{fieldErrors.timezone ?? "Your meals are grouped by the local date in this timezone."}</p><Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => { setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone); changed(); }}><Globe2 size={15} /> Use this device&apos;s timezone</Button></div></section>
        <section className="settings-section card form-section"><h2>Your gentle reminders</h2><label className="switch-row" htmlFor="warning-preference"><span><strong>Show previous food warnings</strong><small>Remind me while typing foods I have actively flagged. Turning this off hides reminders; your watchlist and history stay saved.</small></span><input id="warning-preference" type="checkbox" role="switch" checked={warnings} onChange={(event) => setWarnings(event.target.checked)} disabled={busy} /></label><label className="switch-row" htmlFor="avatar-preference"><span><strong>Show my illustrated companion</strong><small>A friendly face alongside your journal. Text warnings can still appear without it.</small></span><input id="avatar-preference" type="checkbox" role="switch" checked={avatar} onChange={(event) => setAvatar(event.target.checked)} disabled={busy} /></label><Button variant="outline" asChild><Link href="/triggers"><Flag size={15} /> Manage trigger foods</Link></Button></section>
        {error && <p className="alert-error" role="alert">{error}</p>}{saved && <p className="alert-success" role="status"><Check size={16} /> Your preferences have been saved.</p>}
        <div className="form-actions"><p className="field-help">You can change these anytime.</p><Button type="submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}{busy ? "Saving preferences…" : "Save preferences"}</Button></div>
      </form>
      <aside className="stack"><section className="settings-section settings-export card form-section"><ShieldCheck size={27} strokeWidth={1.5} /><h2>Your memories belong to you.</h2><p>Download your food entries, reaction reports and watchlist as JSON. Private photo paths are included; image files are not part of the export.</p><Button variant="outline" asChild><a href="/api/export" download><Download size={16} /> Export my journal</a></Button></section>
        <section className="settings-section settings-account card form-section"><h2>Your account</h2><p className="field-help">Signed in as</p><p className="account-email">{email}</p><form action={signOut}><SignOutButton /></form></section>
        <section className="settings-section settings-danger card form-section"><h2>Delete your account</h2><p>Permanently remove your account, journal entries, reactions, watchlist and photographs.</p><Dialog open={deletionOpen} onOpenChange={(open) => { if (!deletingRef.current) { setDeletionOpen(open); setDeletionError(""); if (!open) { setPassword(""); setConfirmation(""); } } }}><DialogTrigger asChild><Button variant="destructive" disabled={!accountDeletionEnabled}><Trash2 size={16} /> Delete account</Button></DialogTrigger><DialogContent onEscapeKeyDown={(event) => { if (deleting) event.preventDefault(); }} onInteractOutside={(event) => { if (deleting) event.preventDefault(); }}><DialogHeader><DialogTitle>Delete your account permanently?</DialogTitle><DialogDescription>This removes your journal, reaction reports, trigger foods and photographs. This cannot be undone. Export a copy first if you would like to keep your records.</DialogDescription></DialogHeader><form className="deletion-form stack" onSubmit={deleteAccount}><div className="field"><label className="label" htmlFor="deletion-password">Current password</label><input id="deletion-password" className="input" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={deleting} required maxLength={128} /></div><div className="field"><label className="label" htmlFor="deletion-confirmation">Type DELETE to confirm</label><input id="deletion-confirmation" className="input" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" disabled={deleting} required /></div>{deletionError && <p className="alert-error" role="alert">{deletionError}</p>}<DialogFooter><DialogClose asChild><Button variant="outline" disabled={deleting}>Keep my account</Button></DialogClose><Button type="submit" variant="destructive" disabled={deleting || !password || confirmation !== "DELETE"}>{deleting && <LoaderCircle className="spin" size={17} />}{deleting ? "Deleting account…" : "Permanently delete account"}</Button></DialogFooter></form></DialogContent></Dialog>{!accountDeletionEnabled && <p className="field-help">Account deletion has not yet been enabled by this journal&apos;s owner.</p>}</section>
      </aside>
    </div>
  </>;
}
