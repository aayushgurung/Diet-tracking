"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { signInSchema, signUpSchema } from "@/lib/schemas";

export function AuthForm({ configured }: { configured:boolean }) {
  const router = useRouter();
  const [mode,setMode] = useState<"login"|"signup"|"reset">("login");
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [name,setName] = useState("");
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [message,setMessage] = useState("");
  const lock = useRef(false);
  async function submit(event:React.FormEvent) {
    event.preventDefault(); if (!configured || lock.current) return; setError(""); setMessage("");
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const parsed = mode === "signup" ? signUpSchema.safeParse({email,password,display_name:name,timezone}) : signInSchema.safeParse({email,password:mode === "reset" ? "reset" : password});
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    lock.current = true; setBusy(true);
    try {
      const supabase = createClient();
      if (mode === "reset") {
        const {error} = await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:`${location.origin}/auth/callback?next=/reset-password`});
        if(error) throw error;
        setMessage("If an account uses this email, you’ll receive a link to reset your password.");
      } else if (mode === "signup") {
        const {data,error} = await supabase.auth.signUp({email:email.trim(),password,options:{data:{display_name:name.trim(),timezone},emailRedirectTo:`${location.origin}/auth/callback`}});
        if(error) throw error;
        if(data.session) { router.replace("/"); router.refresh(); }
        else { setMessage("Check your email to confirm your account, then return to your journal."); setPassword(""); }
      } else {
        const {error} = await supabase.auth.signInWithPassword({email:email.trim(),password}); if(error) throw error;
        router.replace("/"); router.refresh();
      }
    } catch(cause) { setError(cause instanceof Error ? cause.message : "We couldn’t connect. Please try again."); }
    finally { lock.current=false; setBusy(false); }
  }
  function changeMode(value:typeof mode) { setMode(value); setError(""); setMessage(""); }
  return <><div className="auth-form-heading"><p className="eyebrow">YOUR PRIVATE LITTLE JOURNAL</p><h1>{mode === "signup" ? "Make yourself at home." : mode === "reset" ? "A fresh start." : "Welcome back."}</h1><p className="muted">{mode === "signup" ? "A place to remember your meals and notice how you feel." : mode === "reset" ? "We’ll send you a link to choose a new password." : "Your food memories are right where you left them."}</p></div>{mode !== "reset" && <div className="filter-tabs auth-tabs"><button type="button" disabled={busy} aria-pressed={mode === "login"} className={mode === "login" ? "selected" : ""} onClick={() => changeMode("login")}>Sign in</button><button type="button" disabled={busy} aria-pressed={mode === "signup"} className={mode === "signup" ? "selected" : ""} onClick={() => changeMode("signup")}>Create account</button></div>}{!configured && <p className="alert-error">Supabase isn’t connected yet. <Link className="text-link" href="/setup">Open the setup guide</Link> to enable your private journal.</p>}<form className="auth-form stack" onSubmit={submit}><fieldset className="stack" disabled={busy || !configured}>{mode === "signup" && <div className="field"><label className="label" htmlFor="display-name">What should we call you? <span className="optional">optional</span></label><input className="input" autoComplete="nickname" id="display-name" value={name} maxLength={80} onChange={e => setName(e.target.value)} placeholder="Your first name or nickname" /></div>}<div className="field"><label className="label" htmlFor="email">Email address</label><input className="input" type="email" id="email" name="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required maxLength={254} /></div>{mode !== "reset" && <div className="field"><label className="label" htmlFor="password">Password</label><input className="input" type="password" id="password" name="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={e => setPassword(e.target.value)} placeholder={mode === "signup" ? "At least 8 characters" : "Your password"} minLength={mode === "signup" ? 8 : 1} maxLength={128} required /></div>}</fieldset>{error && <p className="alert-error" role="alert">{error}</p>}{message && <p className="success-note" role="status"><Mail size={17} /> {message}</p>}<Button type="submit" size="lg" disabled={busy || !configured}>{busy ? <LoaderCircle className="spin" size={17} /> : null}{busy ? "Just a moment…" : mode === "signup" ? "Create your journal" : mode === "reset" ? "Send reset link" : "Open your journal"}<ArrowRight size={17} /></Button>{mode === "login" && <button type="button" disabled={busy} className="text-link auth-reset" onClick={() => changeMode("reset")}>Forgot your password?</button>}{mode === "reset" && <button type="button" disabled={busy} className="text-link" onClick={() => changeMode("login")}>Back to sign in</button>}</form><p className="auth-privacy"><LockKeyhole size={14} /> Your notes and photos are private to your account.</p></>;
}
