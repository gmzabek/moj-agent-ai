import { generateEmbedding, toPgVector } from "./embeddings";
import {
  explainSupabaseRlsError,
  supabaseAdmin,
} from "./supabaseAdmin.server";

type MatchDocumentRow = {
  added_at?: string | null;
  content?: string | null;
  created_at?: string | null;
  id?: string | null;
  metadata?: unknown;
  similarity?: number | string | null;
  title?: string | null;
};

export type KnowledgeSearchResult = {
  added_at: string | null;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
  title: string;
};

export type KnowledgeSearchResponse =
  | {
      query: string;
      results: KnowledgeSearchResult[];
      source_documents: string[];
      total_found: number;
    }
  | {
      message: string;
      query: string;
      results: [];
      source_documents: [];
      total_found: 0;
    };

function normalizeMetadata(metadata: unknown) {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }

  return {};
}

function getSourceTitle(
  rowTitle: string | null | undefined,
  metadata: Record<string, unknown>,
) {
  const metadataSource = metadata.source;

  if (typeof metadataSource === "string" && metadataSource.trim()) {
    return metadataSource.trim();
  }

  return rowTitle?.trim() || "Dokument firmowy";
}

async function getAddedAtById(rows: MatchDocumentRow[]) {
  const ids = rows
    .map((row) => row.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  if (ids.length === 0) {
    return new Map<string, string>();
  }

  const { data, error } = await supabaseAdmin
    .from("documents")
    .select("id, created_at")
    .in("id", ids);

  if (error) {
    throw new Error(`Supabase: ${explainSupabaseRlsError(error.message)}`);
  }

  return new Map(
    ((data ?? []) as Array<{ created_at: string | null; id: string }>).flatMap(
      (row) => (row.created_at ? [[row.id, row.created_at] as const] : []),
    ),
  );
}

export async function searchKnowledgeBase(
  query: string,
  matchThreshold = 0.5,
  matchCount = 5,
): Promise<KnowledgeSearchResponse> {
  const cleanQuery = query.trim();

  if (!cleanQuery) {
    throw new Error("Pytanie do bazy wiedzy jest wymagane.");
  }

  const embedding = await generateEmbedding(cleanQuery);
  const { data, error } = await supabaseAdmin.rpc("match_documents", {
    match_count: matchCount,
    match_threshold: matchThreshold,
    query_embedding: toPgVector(embedding),
  });

  if (error) {
    throw new Error(`Supabase: ${explainSupabaseRlsError(error.message)}`);
  }

  const rows = (data ?? []) as MatchDocumentRow[];
  const addedAtById = await getAddedAtById(rows);
  const results = rows
    .map((row) => {
      const metadata = normalizeMetadata(row.metadata);

      return {
        added_at:
          row.added_at ??
          row.created_at ??
          (row.id ? addedAtById.get(row.id) : null) ??
          null,
        content: row.content?.trim() || "",
        metadata,
        similarity:
          typeof row.similarity === "number"
            ? row.similarity
            : Number(row.similarity ?? 0),
        title: getSourceTitle(row.title, metadata),
      };
    })
    .filter((row) => row.content.length > 0);
  const sourceDocuments = Array.from(new Set(results.map((row) => row.title)));

  if (results.length === 0) {
    return {
      message: "Nie znaleziono informacji w bazie wiedzy.",
      query: cleanQuery,
      results: [],
      source_documents: [],
      total_found: 0,
    };
  }

  return {
    query: cleanQuery,
    results,
    source_documents: sourceDocuments,
    total_found: results.length,
  };
}
