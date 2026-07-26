import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedUser } from "../../../lib/supabaseServer.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const saveReportSchema = z.object({
  content: z.string().trim().min(100).max(100_000),
  topic: z.string().trim().min(5).max(300),
});

function countReportSources(content: string) {
  const sourceSection = content.split(/^##\s+Źródła\s*$/im)[1] ?? "";
  const links = Array.from(
    sourceSection.matchAll(/\[[^\]]+\]\((https?:\/\/[^)\s]+)\)/g),
  ).map((match) => match[1]);

  return new Set(links).size;
}

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

export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request).catch(() => null);

  if (!auth) {
    return NextResponse.json(
      { error: "Sesja wygasła. Zaloguj się ponownie." },
      { status: 401 },
    );
  }

  const { data, error } = await auth.supabase
    .from("reports")
    .select("id, topic, word_count, source_count, created_at")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json(
      { error: getDatabaseError(error) },
      { status: 500 },
    );
  }

  return NextResponse.json({
    reports: (data ?? []).map((report) => ({
      createdAt: report.created_at,
      id: report.id,
      sourceCount: report.source_count,
      topic: report.topic,
      wordCount: report.word_count,
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request).catch(() => null);

  if (!auth) {
    return NextResponse.json(
      { error: "Sesja wygasła. Zaloguj się ponownie." },
      { status: 401 },
    );
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Nieprawidłowy JSON." }, { status: 400 });
  }

  const parsed = saveReportSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Raport musi mieć temat oraz co najmniej 100 znaków treści." },
      { status: 400 },
    );
  }

  const wordCount = parsed.data.content.split(/\s+/).filter(Boolean).length;
  const sourceCount = countReportSources(parsed.data.content);
  const { data, error } = await auth.supabase
    .from("reports")
    .insert({
      content: parsed.data.content,
      source_count: sourceCount,
      topic: parsed.data.topic,
      user_id: auth.user.id,
      word_count: wordCount,
    })
    .select("id, created_at")
    .single();

  if (error) {
    return NextResponse.json(
      { error: getDatabaseError(error) },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      report: {
        createdAt: data.created_at,
        id: data.id,
        sourceCount,
        wordCount,
      },
    },
    { status: 201 },
  );
}
