"use client";

import type { User } from "@supabase/supabase-js";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "../../lib/supabase";

type AuthContextValue = {
  isLoading: boolean;
  signOut: () => Promise<void>;
  user: User | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    void supabase.auth.getUser().then(({ data, error }) => {
      if (!isMounted) {
        return;
      }

      setUser(error ? null : data.user);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) {
        return;
      }

      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (isLoading || user || pathname === "/login") {
      return;
    }

    const nextPath = pathname.startsWith("/") ? pathname : "/agent";
    router.replace(`/login?next=${encodeURIComponent(nextPath)}`);
  }, [isLoading, pathname, router, user]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }, [router]);

  const value = useMemo(
    () => ({ isLoading, signOut, user }),
    [isLoading, signOut, user],
  );

  if (isLoading || (!user && pathname !== "/login")) {
    return (
      <main className="auth-loading" aria-live="polite">
        <span />
        <p>Sprawdzam sesję...</p>
      </main>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth musi być użyte wewnątrz AuthProvider.");
  }

  return context;
}
