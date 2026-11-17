"use client";
import { Button } from "@/components/ui/button";
import { BookOpen } from "lucide-react";
export default function JournalError({ reset }: { error: Error; reset: () => void }) { return <div className="empty-state"><BookOpen size={34} /><h1>We couldn’t open this page.</h1><p>Your saved journal hasn’t changed. Check your connection and try again. If this is a new installation, check that the database migration has been applied.</p><Button onClick={reset}>Try again</Button></div>; }
