import { NextResponse } from "next/server";
import { searchKnowledgeBase } from "../../../lib/searchKnowledge.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { query?: unknown };
    const query = typeof body.query === "string" ? body.query.trim() : "";

    if (!query) {
      return NextResponse.json(
        { error: "Pytanie do bazy wiedzy jest wymagane." },
        { status: 400 },
      );
    }

    return NextResponse.json(await searchKnowledgeBase(query));
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nie udało się przeszukać bazy wiedzy.",
      },
      { status: 500 },
    );
  }
}
