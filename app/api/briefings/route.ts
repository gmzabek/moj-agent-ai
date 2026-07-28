import { NextResponse } from "next/server";
import { listBriefingsForUser } from "@/lib/briefings.server";
import {
  getApiErrorStatus,
  requireAuthenticatedUser,
} from "@/lib/supabaseServer.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser(request);
    const briefings = await listBriefingsForUser(user.id, 30);

    return NextResponse.json({ briefings });
  } catch (error) {
    const status = getApiErrorStatus(error);
    const message =
      error instanceof Error
        ? error.message
        : "Nie udało się pobrać briefingów.";

    return NextResponse.json({ error: message }, { status });
  }
}
