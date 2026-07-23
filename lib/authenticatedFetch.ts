import { supabase } from "./supabase";

export async function getAuthHeaders() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Sesja wygasła. Zaloguj się ponownie.");
  }

  return {
    Authorization: `Bearer ${session.access_token}`,
  };
}

export async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
) {
  const headers = new Headers(init.headers);
  const authHeaders = await getAuthHeaders();

  headers.set("Authorization", authHeaders.Authorization);

  return fetch(input, {
    ...init,
    headers,
  });
}
