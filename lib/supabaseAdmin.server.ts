export function explainSupabaseRlsError(message: string) {
  if (!message.toLowerCase().includes("row-level security")) {
    return message;
  }

  return `${message}. Sprawdź migrację 20260723000000_auth_and_private_data.sql i polityki RLS w Supabase.`;
}
