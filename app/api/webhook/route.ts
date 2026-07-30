import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { saveWebhookEvent } from "@/lib/webhookEvents.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODEL_ID = "gemini-3.1-flash-lite";
const MAX_BODY_BYTES = 64 * 1024;

const feedbackDataSchema = z
  .object({
    customer: z.string().trim().min(1).max(200),
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().min(1).max(5_000),
  })
  .passthrough();

const alertDataSchema = z
  .object({
    service: z.string().trim().min(1).max(200),
    status: z.string().trim().min(1).max(100),
    since: z.string().datetime({ offset: true }),
  })
  .passthrough();

const orderDataSchema = z
  .object({
    product: z.string().trim().min(1).max(300),
    customer: z.string().trim().email().max(320),
    amount: z.number().positive().max(100_000_000),
  })
  .passthrough();

const webhookSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("feedback"), data: feedbackDataSchema }),
  z.object({ type: z.literal("alert"), data: alertDataSchema }),
  z.object({ type: z.literal("order"), data: orderDataSchema }),
]);

type WebhookPayload = z.infer<typeof webhookSchema>;

const analysisInstructions: Record<WebhookPayload["type"], string> = {
  feedback: `Przeanalizuj opinię klienta. Zwróć wyłącznie:
## Sentyment
[pozytywny, neutralny lub negatywny wraz z krótkim uzasadnieniem]

## Priorytet
[niski, średni, wysoki lub krytyczny wraz z uzasadnieniem]

## Najważniejszy problem
[jednozdaniowe podsumowanie]

## Sugerowana odpowiedź
[krótka, empatyczna odpowiedź gotowa do wysłania klientowi]`,
  alert: `Przeanalizuj alert techniczny. Zwróć wyłącznie:
## Severity
[low, medium, high lub critical wraz z uzasadnieniem]

## Ocena sytuacji
[krótkie podsumowanie wpływu i czasu trwania]

## Zalecane działania
[uporządkowana lista konkretnych kroków operacyjnych]

## Eskalacja
[wskaż, czy i do kogo należy eskalować]`,
  order: `Przeanalizuj nowe zamówienie. Zwróć wyłącznie:
## Potwierdzenie
[krótkie potwierdzenie przyjęcia]

## Podsumowanie zamówienia
[produkt, klient i kwota — dokładnie na podstawie danych]

## Następny krok
[jedna konkretna rekomendacja operacyjna]`,
};

function validationError(error: z.ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";

  if (!contentType.includes("application/json")) {
    return NextResponse.json(
      { success: false, error: "Content-Type musi być application/json." },
      { status: 415 },
    );
  }

  const rawBody = await request.text();

  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
    return NextResponse.json(
      { success: false, error: "Payload jest zbyt duży. Limit wynosi 64 KB." },
      { status: 413 },
    );
  }

  let body: unknown;

  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { success: false, error: "Nieprawidłowy JSON." },
      { status: 400 },
    );
  }

  const parsed = webhookSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: "Nieprawidłowe dane webhooka.",
        details: validationError(parsed.error),
      },
      { status: 400 },
    );
  }

  const event = parsed.data;

  try {
    const { text } = await generateText({
      model: google(MODEL_ID),
      system:
        "Jesteś agentem operacyjnym analizującym zdarzenia zewnętrzne. " +
        "Odpowiadaj po polsku, konkretnie i wyłącznie na podstawie przekazanych danych. " +
        "Nie wymyślaj brakujących faktów.",
      prompt:
        `${analysisInstructions[event.type]}\n\n` +
        `Dane zdarzenia:\n${JSON.stringify(event.data, null, 2)}`,
      temperature: 0.2,
    });
    const analysis = text.trim();

    if (!analysis) {
      throw new Error("Model AI zwrócił pustą analizę.");
    }

    const saved = await saveWebhookEvent({
      type: event.type,
      data: event.data,
      analysis,
    });

    return NextResponse.json({
      success: true,
      analysis,
      event_id: saved.id,
    });
  } catch (error) {
    console.error("Webhook processing failed:", error);
    return NextResponse.json(
      { success: false, error: "Nie udało się przetworzyć webhooka." },
      { status: 500 },
    );
  }
}
