import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function NotFound() { return <main className="empty-state"><h1>This page isn’t in your journal.</h1><p>The entry may have been removed, or this link has changed.</p><Button asChild><Link href="/">Back to today</Link></Button></main>; }
