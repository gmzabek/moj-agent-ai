type GeminiEmbeddingResponse = {
  embedding?: {
    values?: number[];
  };
  embeddings?: Array<{
    values?: number[];
  }>;
};

const EMBEDDING_MODEL = "gemini-embedding-2";
const EMBEDDING_DIMENSIONS = 768;

export async function generateEmbedding(text: string) {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!apiKey) {
    throw new Error("Brakuje GOOGLE_GENERATIVE_AI_API_KEY w .env.local.");
  }

  const trimmedText = text.trim();

  if (!trimmedText) {
    throw new Error("Nie można wygenerować embeddingu dla pustego tekstu.");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`,
    {
      body: JSON.stringify({
        content: {
          parts: [{ text: trimmedText }],
        },
        model: `models/${EMBEDDING_MODEL}`,
        output_dimensionality: EMBEDDING_DIMENSIONS,
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Gemini Embedding API zwróciło błąd ${response.status}: ${errorText}`,
    );
  }

  const data = (await response.json()) as GeminiEmbeddingResponse;
  const embedding = data.embedding?.values ?? data.embeddings?.[0]?.values;

  if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error("Gemini nie zwróciło poprawnego wektora embeddingu.");
  }

  return embedding;
}

export function toPgVector(embedding: number[]) {
  return `[${embedding.join(",")}]`;
}
