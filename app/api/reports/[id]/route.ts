import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedUser } from "../../../../lib/supabaseServer.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reportIdSchema = z.string().uuid();

function getDatabaseError(error: {
  code?: string;
  message: string;
}) {
  if (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.message.toLowerCase().includes("reports")
  ) {
    return "Tabela raportów nie istnieje. Zastosuj migrację 20260726000000_reports.sql w Supabase.";
  }

  return `Supabase: ${error.message}`;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuthenticatedUser(request).catch(() => null);

  if (!auth) {
    return NextResponse.json(
      { error: "Sesja wygasła. Zaloguj się ponownie." },
      { status: 401 },
    );
  }

  const { id: rawId } = await context.params;
  const parsedId = reportIdSchema.safeParse(rawId);

  if (!parsedId.success) {
    return NextResponse.json(
      { error: "Nieprawidłowy identyfikator raportu." },
      { status: 400 },
    );
  }

  const { data, error } = await auth.supabase
    .from("reports")
    .select("id, topic, content, word_count, source_count, created_at")
    .eq("id", parsedId.data)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: getDatabaseError(error) },
      { status: 500 },
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "Nie znaleziono raportu." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    report: {
      content: data.content,
      createdAt: data.created_at,
      id: data.id,
      sourceCount: data.source_count,
      topic: data.topic,
      wordCount: data.word_count,
    },
  });
}
