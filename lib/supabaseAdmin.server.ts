import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || (!supabaseServiceRoleKey && !supabaseAnonKey)) {
  throw new Error(
    "Brakuje NEXT_PUBLIC_SUPABASE_URL oraz klucza SUPABASE_SERVICE_ROLE_KEY albo NEXT_PUBLIC_SUPABASE_ANON_KEY.",
  );
}

export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceRoleKey ?? supabaseAnonKey!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

export function explainSupabaseRlsError(message: string) {
  if (!message.toLowerCase().includes("row-level security")) {
    return message;
  }

  return (
    `${message}. Tabela documents ma włączone RLS. ` +
    "Uruchom SQL z pliku SUPABASE_FIX_DOCUMENTS_RLS.sql w Supabase SQL Editor " +
    "albo dodaj SUPABASE_SERVICE_ROLE_KEY do .env.local i zrestartuj dev server."
  );
}
