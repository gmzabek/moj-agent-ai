import { NextResponse } from "next/server";
import {
  getSecurityDashboardData,
  isSecurityAdmin,
  isSecurityAdminConfigured,
} from "../../../../lib/securityAdmin.server";
import { requireAuthenticatedUser } from "../../../../lib/supabaseServer.server";

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
      { error: "Nie masz uprawnień do panelu bezpieczeństwa." },
      { status: 403 },
    );
  }

  try {
    return NextResponse.json(await getSecurityDashboardData(), {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Security dashboard failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nie udało się pobrać danych panelu bezpieczeństwa.",
      },
      { status: 500 },
    );
  }
}
