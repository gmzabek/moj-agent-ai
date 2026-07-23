import { NextResponse } from "next/server";
import {
  explainSupabaseRlsError,
  supabaseAdmin,
} from "../../../lib/supabaseAdmin.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DocumentRow = {
  content: string | null;
  created_at: string | null;
  id: string;
  metadata: Record<string, unknown> | null;
  title: string | null;
};

function getNumberMetadata(
  metadata: Record<string, unknown> | null,
  key: string,
  fallback: number,
) {
  const value = metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("documents")
      .select("id, title, content, metadata, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(explainSupabaseRlsError(error.message));
    }

    const documents = new Map<
      string,
      {
        chunks: Array<{
          content: string;
          created_at: string | null;
          id: string;
          metadata: Record<string, unknown>;
          order: number;
        }>;
        created_at: string | null;
        title: string;
      }
    >();

    for (const row of (data ?? []) as DocumentRow[]) {
      const title = row.title?.trim() || "Bez tytułu";
      const metadata = row.metadata ?? {};
      const current =
        documents.get(title) ??
        {
          chunks: [],
          created_at: row.created_at,
          title,
        };

      current.chunks.push({
        content: row.content?.trim() || "",
        created_at: row.created_at,
        id: row.id,
        metadata,
        order: getNumberMetadata(metadata, "chunk_index", current.chunks.length),
      });

      if (
        row.created_at &&
        (!current.created_at || new Date(row.created_at) > new Date(current.created_at))
      ) {
        current.created_at = row.created_at;
      }

      documents.set(title, current);
    }

    const groupedDocuments = Array.from(documents.values())
      .map((document) => ({
        ...document,
        chunks: document.chunks.sort((a, b) => a.order - b.order),
      }))
      .sort((a, b) => {
        const firstDate = a.created_at ? new Date(a.created_at).getTime() : 0;
        const secondDate = b.created_at ? new Date(b.created_at).getTime() : 0;
        return secondDate - firstDate;
      });

    return NextResponse.json({
      documents: groupedDocuments,
      status: {
        documents: groupedDocuments.length,
        fragments: groupedDocuments.reduce(
          (sum, document) => sum + document.chunks.length,
          0,
        ),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nie udało się pobrać bazy wiedzy.",
      },
      { status: 500 },
    );
  }
}
