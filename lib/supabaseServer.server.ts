import {
  createClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Brakuje NEXT_PUBLIC_SUPABASE_URL albo NEXT_PUBLIC_SUPABASE_ANON_KEY.",
  );
}

export class AuthenticationError extends Error {
  constructor(message = "Wymagane jest zalogowanie.") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export type AuthenticatedSupabase = {
  supabase: SupabaseClient;
  user: User;
};

export async function requireAuthenticatedUser(
  request: Request,
): Promise<AuthenticatedSupabase> {
  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";

  if (!accessToken) {
    throw new AuthenticationError();
  }

  const supabase = createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(accessToken);

  if (error || !user) {
    throw new AuthenticationError("Sesja jest nieprawidłowa lub wygasła.");
  }

  return { supabase, user };
}

export function getApiErrorStatus(error: unknown) {
  return error instanceof AuthenticationError ? 401 : 500;
}
