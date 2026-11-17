import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getJournal } from "@/lib/server/queries";

export async function GET() {
  if (!isSupabaseConfigured) return NextResponse.json({ error: "Connect Supabase first." }, { status: 503 });
  const client = await createClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return NextResponse.json({ error: "Sign in to export your journal." }, { status: 401 });
  try {
    const journal = await getJournal();
    const exported = {
      version: 1,
      exported_at: new Date().toISOString(),
      note: "Photograph paths are included; image files and temporary signed URLs are not included.",
      ...journal,
      entries: journal.entries.map((entry) => {
        const exportedEntry = { ...entry };
        delete exportedEntry.photo_url;
        return exportedEntry;
      }),
    };
    return new NextResponse(JSON.stringify(exported, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": 'attachment; filename="food-journal-export.json"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Your export couldn’t be prepared. Please try again." }, { status: 500 });
  }
}
