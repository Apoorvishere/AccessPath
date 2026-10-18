import { createServerSupabase, supabaseConfigured } from "@/lib/supabase/server";

const json = (body: unknown, status: number) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET() {
  if (!supabaseConfigured()) return json({ error: "Workspace is not configured." }, 503);
  const supabase = await createServerSupabase();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return json({ error: "Sign in to view your scans." }, 401);
  const { data, error } = await supabase.from("scans")
    .select("id,source,target_url,task,status,created_at,finished_at")
    .order("created_at", { ascending: false }).limit(30);
  if (error) return json({ error: "Could not load your scans." }, 500);
  return json({ scans: data }, 200);
}
