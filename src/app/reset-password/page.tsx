import { ResetPasswordForm } from "@/components/reset-password-form";
import { requireUser } from "@/lib/server/queries";
export const dynamic="force-dynamic";
export default async function ResetPasswordPage(){await requireUser();return <main className="setup-page"><section className="setup-card card stack"><h1>Choose a new password</h1><p className="muted">A fresh start for your private journal.</p><ResetPasswordForm /></section></main>;}
