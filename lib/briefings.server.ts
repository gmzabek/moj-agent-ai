import { createClient } from "@supabase/supabase-js";

export type BriefingInsert = {
  date: string;
  content: string;
};

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Brakuje NEXT_PUBLIC_SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function saveBriefing(briefing: BriefingInsert) {
  const { data, error } = await getSupabaseAdmin()
    .from("briefings")
    .insert(briefing)
    .select("id, created_at")
    .single();

  if (error) {
    throw new Error(`Nie udało się zapisać briefingu w Supabase: ${error.message}`);
  }

  return data as { id: string; created_at: string };
}
