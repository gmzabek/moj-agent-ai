"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export type UserProfile = {
  id: string;
  name: string | null;
  preferences: Record<string, string>;
};

function toPreferences(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] =>
      typeof entry[1] === "string",
    ),
  );
}

function createUserId() {
  return crypto.randomUUID();
}

function isValidUserId(value: string | null) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

function getProfileErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;

    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return "Nie udało się połączyć z profilem w Supabase.";
}

export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadProfile() {
      try {
        let userId = window.localStorage.getItem("user_id");

        if (!isValidUserId(userId)) {
          userId = createUserId();
          window.localStorage.setItem("user_id", userId);
        }

        if (!isCancelled) {
          setUserId(userId);
        }

        const { data: existingProfile, error: selectError } = await supabase
          .from("user_profiles")
          .select("id, name, preferences")
          .eq("id", userId)
          .maybeSingle();

        if (selectError) {
          throw selectError;
        }

        let profileData = existingProfile;

        if (!profileData) {
          const { data: createdProfile, error: insertError } = await supabase
            .from("user_profiles")
            .insert({ id: userId })
            .select("id, name, preferences")
            .single();

          if (insertError && insertError.code !== "23505") {
            throw insertError;
          }

          if (createdProfile) {
            profileData = createdProfile;
          } else {
            const { data: concurrentProfile, error: concurrentSelectError } =
              await supabase
                .from("user_profiles")
                .select("id, name, preferences")
                .eq("id", userId)
                .maybeSingle();

            if (concurrentSelectError || !concurrentProfile) {
              throw concurrentSelectError ?? insertError;
            }

            profileData = concurrentProfile;
          }
        }

        if (!profileData) {
          throw new Error("Nie udało się utworzyć profilu użytkownika.");
        }

        if (!isCancelled) {
          setProfile({
            id: profileData.id,
            name: profileData.name,
            preferences: toPreferences(profileData.preferences),
          });
          setProfileError(null);
        }
      } catch (error) {
        if (!isCancelled) {
          setProfileError(
            error instanceof Error
              ? error.message
              : getProfileErrorMessage(error),
          );
        }
      } finally {
        if (!isCancelled) {
          setIsProfileLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      isCancelled = true;
    };
  }, []);

  return { isProfileLoading, profile, profileError, userId };
}
