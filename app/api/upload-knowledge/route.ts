import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { splitIntoChunks } from "../../../lib/chunking";
import { generateEmbedding, toPgVector } from "../../../lib/embeddings";
import { explainSupabaseRlsError } from "../../../lib/supabaseAdmin.server";
import { requireAuthenticatedUser } from "../../../lib/supabaseServer.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UploadBody = {
  content?: unknown;
  title?: unknown;
};

type UploadProgress = {
  current: number;
  message: string;
  total: number;
};

function parseUploadBody(body: UploadBody) {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const content = typeof body.content === "string" ? body.content.trim() : "";

  if (!title) {
    throw new Error("Tytuł dokumentu jest wymagany.");
  }

  if (!content) {
    throw new Error("Treść dokumentu jest wymagana.");
  }

  return { content, title };
}

async function saveKnowledge(
  supabase: SupabaseClient,
  userId: string,
  title: string,
  content: string,
  onProgress?: (progress: UploadProgress) => void,
) {
  const chunks = splitIntoChunks(content);

  if (chunks.length === 0) {
    throw new Error("Nie udało się utworzyć fragmentów z podanej treści.");
  }

  for (const [index, chunk] of chunks.entries()) {
    onProgress?.({
      current: index + 1,
      message: `Przetwarzam fragment ${index + 1} z ${chunks.length}...`,
      total: chunks.length,
    });

    const embedding = await generateEmbedding(chunk);
    const { error } = await supabase.from("documents").insert({
      content: chunk,
      created_at: new Date().toISOString(),
      embedding: toPgVector(embedding),
      metadata: {
        chunk_index: index,
        source: title,
        total_chunks: chunks.length,
      },
      title,
      user_id: userId,
    });

    if (error) {
      throw new Error(`Supabase: ${explainSupabaseRlsError(error.message)}`);
    }
  }

  return chunks.length;
}

function streamEvent(controller: ReadableStreamDefaultController, value: unknown) {
  controller.enqueue(new TextEncoder().encode(`${JSON.stringify(value)}\n`));
}

export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request).catch(() => null);

  if (!auth) {
    return NextResponse.json(
      { error: "Wymagane jest zalogowanie." },
      { status: 401 },
    );
  }

  try {
    const { data, error } = await auth.supabase
      .from("documents")
      .select("title, created_at")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(explainSupabaseRlsError(error.message));
    }

    const documents = new Map<
      string,
      { chunks: number; created_at: string; title: string }
    >();

    for (const row of (data ?? []) as { created_at: string; title: string | null }[]) {
      const title = row.title?.trim() || "Bez tytułu";
      const current = documents.get(title);

      if (!current) {
        documents.set(title, {
          chunks: 1,
          created_at: row.created_at,
          title,
        });
        continue;
      }

      current.chunks += 1;

      if (new Date(row.created_at) > new Date(current.created_at)) {
        current.created_at = row.created_at;
      }
    }

    return NextResponse.json({ documents: Array.from(documents.values()) });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nie udało się pobrać dokumentów.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request).catch(() => null);

  if (!auth) {
    return NextResponse.json(
      { error: "Wymagane jest zalogowanie." },
      { status: 401 },
    );
  }

  try {
    const { content, title } = parseUploadBody((await request.json()) as UploadBody);
    const wantsStream = request.headers.get("x-upload-progress") === "stream";

    if (!wantsStream) {
      const chunksSaved = await saveKnowledge(
        auth.supabase,
        auth.user.id,
        title,
        content,
      );

      return NextResponse.json({
        chunks_saved: chunksSaved,
        success: true,
      });
    }

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const chunksSaved = await saveKnowledge(
            auth.supabase,
            auth.user.id,
            title,
            content,
            (progress) => {
              streamEvent(controller, {
                ...progress,
                type: "progress",
              });
            },
          );

          streamEvent(controller, {
            chunks_saved: chunksSaved,
            message: `Zapisano ${chunksSaved} fragmentów!`,
            success: true,
            type: "done",
          });
        } catch (error) {
          streamEvent(controller, {
            error:
              error instanceof Error
                ? error.message
                : "Nie udało się zapisać dokumentu.",
            type: "error",
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Cache-Control": "no-cache",
        "Content-Type": "application/x-ndjson; charset=utf-8",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nie udało się zapisać dokumentu.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAuthenticatedUser(request).catch(() => null);

  if (!auth) {
    return NextResponse.json(
      { error: "Wymagane jest zalogowanie." },
      { status: 401 },
    );
  }

  try {
    const body = (await request.json()) as { title?: unknown };
    const title = typeof body.title === "string" ? body.title.trim() : "";

    if (!title) {
      return NextResponse.json(
        { error: "Tytuł dokumentu jest wymagany." },
        { status: 400 },
      );
    }

    const { error } = await auth.supabase
      .from("documents")
      .delete()
      .eq("title", title)
      .eq("user_id", auth.user.id);

    if (error) {
      throw new Error(explainSupabaseRlsError(error.message));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nie udało się usunąć dokumentu.",
      },
      { status: 500 },
    );
  }
}
