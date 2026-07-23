function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function splitLongText(text: string, chunkSize: number, overlap: number) {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(text.length, start + chunkSize);
    const chunk = normalizeWhitespace(text.slice(start, end));

    if (chunk) {
      chunks.push(chunk);
    }

    if (end >= text.length) {
      break;
    }

    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
}

function getOverlapText(text: string, overlap: number) {
  if (overlap <= 0 || text.length <= overlap) {
    return text;
  }

  const tail = text.slice(-overlap);
  const wordBoundary = tail.indexOf(" ");

  return normalizeWhitespace(wordBoundary > -1 ? tail.slice(wordBoundary + 1) : tail);
}

export function splitIntoChunks(
  text: string,
  chunkSize: number = 500,
  overlap: number = 50,
): string[] {
  const normalizedText = text.replace(/\r\n/g, "\n").trim();

  if (!normalizedText) {
    return [];
  }

  const safeChunkSize = Math.max(100, chunkSize);
  const safeOverlap = Math.max(0, Math.min(overlap, Math.floor(safeChunkSize / 3)));
  const sentences =
    normalizedText.match(/[^.!?\n]+[.!?]?|\n+/g)?.map(normalizeWhitespace).filter(Boolean) ??
    [];

  if (sentences.length === 0) {
    return splitLongText(normalizedText, safeChunkSize, safeOverlap);
  }

  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if (sentence.length > safeChunkSize) {
      if (current) {
        chunks.push(current);
        current = "";
      }

      chunks.push(...splitLongText(sentence, safeChunkSize, safeOverlap));
      continue;
    }

    const next = current ? `${current} ${sentence}` : sentence;

    if (next.length <= safeChunkSize || !current) {
      current = next;
      continue;
    }

    chunks.push(current);
    const overlapText = getOverlapText(current, safeOverlap);
    current = overlapText ? `${overlapText} ${sentence}` : sentence;
  }

  if (current) {
    chunks.push(current);
  }

  return chunks.map(normalizeWhitespace).filter(Boolean);
}
