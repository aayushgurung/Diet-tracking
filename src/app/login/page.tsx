import Link from "next/link";
import { Suspense } from "react";
import { BookOpen, Leaf, Sprout } from "lucide-react";
import { AuthForm } from "@/components/auth-form";
import { Avatar } from "@/components/avatar";
import { APP_NAME } from "@/lib/config";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { AuthNotice } from "@/components/auth-notice";
export const dynamic = "force-dynamic";
export default function LoginPage() { return <main className="auth-page"><section className="auth-story"><Link href="/" className="auth-brand"><span><BookOpen size={24} /></span>{APP_NAME}<i /></Link><div className="auth-story-copy"><p className="eyebrow">A LITTLE MORE IN TUNE WITH YOU</p><h2>Good food.<br />Little notes.<br /><em>Your story.</em></h2><p>Remember what you ate.<br />Make space for how you feel.</p></div><div className="auth-mascot"><Avatar state="neutral" size="lg" message="A little note is a lovely place to start." /><Leaf className="auth-floating-leaf" size={50} strokeWidth={1} /></div><p className="auth-story-footer"><Sprout size={16} /> No numbers. No judgement. Just you.</p></section><section className="auth-panel"><div className="auth-panel-inner"><Suspense><AuthNotice /></Suspense><AuthForm configured={isSupabaseConfigured} /><p className="small-disclaimer">For personal observations. Not medical advice.</p></div></section></main>; }
