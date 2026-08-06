import { NextResponse } from "next/server";
import {
  isSecurityAdmin,
  isSecurityAdminConfigured,
} from "../../../../lib/securityAdmin.server";
import { requireAuthenticatedUser } from "../../../../lib/supabaseServer.server";
import { getUsageDashboardData } from "../../../../lib/usageDashboard.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request).catch(() => null);

  if (!auth) {
    return NextResponse.json(
      { error: "Wymagane jest zalogowanie." },
      { status: 401 },
    );
  }

  if (!isSecurityAdminConfigured()) {
    return NextResponse.json(
      {
        error:
          "Panel administratora nie jest skonfigurowany. Ustaw ADMIN_EMAILS w środowisku serwera.",
      },
      { status: 503 },
    );
  }

  if (!isSecurityAdmin(auth.user)) {
    return NextResponse.json(
      { error: "Nie masz uprawnień do dashboardu użycia." },
      { status: 403 },
    );
  }

  try {
    return NextResponse.json(await getUsageDashboardData(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Usage dashboard failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nie udało się pobrać dashboardu użycia.",
      },
      { status: 500 },
    );
  }
}
