import { NextResponse } from "next/server";
import { generateEmbedding } from "../../../lib/embeddings";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { text?: unknown };
    const text = typeof body.text === "string" ? body.text.trim() : "";

    if (!text) {
      return NextResponse.json(
        { error: "Pole text jest wymagane." },
        { status: 400 },
      );
    }

    const embedding = await generateEmbedding(text);

    return NextResponse.json({ embedding });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nie udało się wygenerować embeddingu.",
      },
      { status: 500 },
    );
  }
}
