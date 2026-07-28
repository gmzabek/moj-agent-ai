import { createClient } from "@supabase/supabase-js";

export type BriefingInsert = {
  date: string;
  content: string;
  user_id?: string | null;
};

export type BriefingRecord = {
  id: string;
  created_at: string;
  content: string;
  date: string;
  user_id: string | null;
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

export async function listBriefingsForUser(userId: string, limit = 30) {
  const { data, error } = await getSupabaseAdmin()
    .from("briefings")
    .select("*")
    .or(`user_id.is.null,user_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(
      `Nie udało się pobrać briefingów z Supabase: ${error.message}`,
    );
  }

  return (data ?? []) as BriefingRecord[];
}
