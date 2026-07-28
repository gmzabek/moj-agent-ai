import { NextResponse } from "next/server";
import {
  generateAndSaveMorningBriefing,
  getMorningBriefingErrorMessage,
} from "@/lib/morningBriefing.server";
import {
  getApiErrorStatus,
  requireAuthenticatedUser,
} from "@/lib/supabaseServer.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();

  if (!cronSecret) {
    console.error("Morning briefing failed: CRON_SECRET is not configured.");
    return NextResponse.json(
      {
        success: false,
        error: "Brakuje CRON_SECRET w zmiennych środowiskowych serwera.",
      },
      { status: 500 },
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { success: false, error: "Brak autoryzacji." },
      { status: 401 },
    );
  }

  try {
    const result = await generateAndSaveMorningBriefing();

    return NextResponse.json({
      success: true,
      date: result.date,
      preview: result.content.replace(/\s+/g, " ").slice(0, 240),
      id: result.id,
    });
  } catch (error) {
    console.error("Morning briefing failed:", error);
    return NextResponse.json(
      { success: false, error: getMorningBriefingErrorMessage(error) },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser(request);
    const briefing = await generateAndSaveMorningBriefing(user.id);

    return NextResponse.json(
      {
        briefing: {
          content: briefing.content,
          date: briefing.date,
          id: briefing.id,
        },
        success: true,
      },
      { status: 201 },
    );
  } catch (error) {
    const status = getApiErrorStatus(error);
    const message =
      status === 401
        ? error instanceof Error
          ? error.message
          : "Wymagane jest zalogowanie."
        : getMorningBriefingErrorMessage(error);

    console.error("Manual morning briefing failed:", error);
    return NextResponse.json(
      { error: message, success: false },
      { status },
    );
  }
}
