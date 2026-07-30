import { GoogleGenAI, Modality } from "@google/genai";

const imageModels = ["gemini-3.1-flash-lite-image"];
// Limits image-generation fallback attempts consistently with the API step budget.
const maxSteps = 3;
const timeoutMs = 30000;

function getErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return "Nieznany błąd API.";
  }

  try {
    const parsed = JSON.parse(error.message) as {
      error?: { message?: string; status?: string };
    };
    const apiMessage = parsed.error?.message;

    if (apiMessage?.toLowerCase().includes("quota")) {
      const retryMatch = apiMessage.match(/retry in ([0-9.]+)s/i);
      const retryText = retryMatch
        ? ` Spróbuj ponownie za około ${Math.ceil(Number(retryMatch[1]))} s.`
        : "";

      return `Limit darmowych zapytań dla modelu obrazowego został wykorzystany.${retryText}`;
    }

    return apiMessage || error.message;
  } catch {
    return error.message;
  }
}

function isQuotaError(error: unknown) {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  return (
    message.includes("quota") ||
    message.includes("resource_exhausted") ||
    message.includes("rate limit") ||
    message.includes("429")
  );
}

function withTimeout<T>(promise: Promise<T>, milliseconds: number) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(
        () =>
          reject(
            new Error("Generowanie przekroczyło limit 30 sekund. Spróbuj ponownie."),
          ),
        milliseconds,
      );
    }),
  ]);
}

export async function POST(req: Request) {
  const { prompt }: { prompt?: unknown } = await req.json();
  const cleanPrompt = typeof prompt === "string" ? prompt.trim() : "";
  const apiKey =
    process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!cleanPrompt) {
    return Response.json(
      { error: "Podaj opis obrazu do wygenerowania." },
      { status: 400 },
    );
  }

  if (!apiKey) {
    return Response.json(
      {
        error:
          "Brakuje zmiennej środowiskowej GOOGLE_API_KEY albo GOOGLE_GENERATIVE_AI_API_KEY.",
      },
      { status: 500 },
    );
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    let response: Awaited<ReturnType<typeof ai.models.generateContent>> | null = null;
    let lastError: unknown = null;

    for (const imageModel of imageModels.slice(0, maxSteps)) {
      try {
        response = await withTimeout(
          ai.models.generateContent({
            model: imageModel,
            contents: cleanPrompt,
            config: {
              responseModalities: [Modality.TEXT, Modality.IMAGE],
            },
          }),
          timeoutMs,
        );
        break;
      } catch (modelError) {
        lastError = modelError;

        if (!isQuotaError(modelError)) {
          throw modelError;
        }
      }
    }

    if (!response) {
      throw lastError ?? new Error("Nie udalo sie polaczyc z modelem obrazowym.");
    }

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((part) => part.inlineData?.data);
    const textPart = parts.find((part) => part.text);

    if (!imagePart?.inlineData?.data) {
      return Response.json(
        { error: "Model nie zwrócił obrazu. Spróbuj doprecyzować opis." },
        { status: 500 },
      );
    }

    const mimeType = imagePart.inlineData.mimeType || "image/png";

    return Response.json({
      image: `data:${mimeType};base64,${imagePart.inlineData.data}`,
      text: textPart?.text ?? "",
    });
  } catch (error) {
    const message = isQuotaError(error)
      ? "Google blokuje generowanie obrazow dla tego projektu API albo modelu. To nie musi znaczyc, ze dzisiaj wygenerowales obrazy w tej aplikacji - limity sa liczone per projekt Google Cloud/AI Studio i konkretny model. Sprawdz aktywne limity w Google AI Studio lub wlacz billing dla projektu."
      : getErrorMessage(error);

    return Response.json({ error: message }, { status: 500 });
  }
}
