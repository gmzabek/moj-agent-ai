import { google } from "@ai-sdk/google";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  toUIMessageChunk,
  type ModelMessage,
  type UIMessage,
  type UIMessageChunk,
} from "ai";

// AI SDK 5 uses stopWhen as the supported equivalent of maxSteps: 3.
const maxSteps = 3;

const systemPrompt = `Jesteś asystentem który odpowiada w DOKŁADNIE takim formacie jak w przykładach poniżej.

## PRZYKŁADY

Użytkownik: "Czym jest API?"
Asystent:
📖 **API (Application Programming Interface)**
Prosty opis: To "kelner" w restauracji - pośrednik między tobą a kuchnią.
Ty zamawiasz (wysyłasz request), kelner zanosi do kuchni (serwer), i przynosi danie (response).
⚡ W praktyce: Gdy Allegro pokazuje status paczki InPost - pobiera dane przez API z systemu InPost.
🔗 Powiązane: REST, endpoint, JSON, HTTP

Użytkownik: "Czym jest B2B?"
Asystent:
📖 **B2B (Business-to-Business)**
Prosty opis: To umowa między Twoją firmą a firmą klienta - jak dwóch rzemieślników na targu, a nie sklep i klient.
⚡ W praktyce: Programista zakłada JDG, wystawia fakturę VAT zamiast mieć umowę o pracę. Zarabia więcej netto, ale sam płaci ZUS i nie ma urlopu.
🔗 Powiązane: JDG, faktura VAT, ZUS, umowa o pracę

## ZASADY
- ZAWSZE odpowiadaj w DOKŁADNIE tym formacie: 📖 termin → prosty opis z analogią → ⚡ praktyczny przykład → 🔗 powiązane terminy
- Analogie powinny być z codziennego życia: restauracja, mieszkanie, samochód, sklep, kuchnia, podróż
- Odpowiedź max 6 linii
- Jeśli pytanie NIE jest o definicję/termin - odpowiedz normalnie, ale zachowaj zwięzły styl
- Odpowiadaj po polsku`;

function getMessageText(parts: { type: string; text?: string }[]) {
  return parts
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("");
}

function getLastUserText(messages: UIMessage[]) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === "user") {
      return getMessageText(messages[i].parts);
    }
  }

  return "";
}

function getErrorText(error: unknown) {
  return error instanceof Error ? error.message : String(error ?? "Nieznany błąd");
}

function isQuotaError(error: unknown) {
  const message = getErrorText(error).toLowerCase();

  return (
    message.includes("quota exceeded") ||
    message.includes("exceeded your current quota") ||
    message.includes("rate-limit") ||
    message.includes("rate limit") ||
    message.includes("resource_exhausted")
  );
}

function getOfflineDefinition(userText: string) {
  const normalizedText = userText.toLowerCase();

  if (normalizedText.includes("agent")) {
    return `📖 **Agent AI (AI Agent)**
Prosty opis: To jak samodzielny asystent, który nie tylko odpowiada, ale też potrafi zaplanować kroki i wykonać zadanie.
Można go porównać do pracownika z checklistą: dostaje cel, sprawdza kontekst, wybiera narzędzia i działa.
⚡ W praktyce: Agent AI może odebrać zgłoszenie klienta, sprawdzić status zamówienia w systemie i przygotować odpowiedź.
🔗 Powiązane: prompt, narzędzia, workflow, automatyzacja`;
  }

  if (normalizedText.includes("prompt")) {
    return `📖 **Prompt**
Prosty opis: To instrukcja dla AI - jak brief dla specjalisty, który mówi co ma zrobić i w jakim stylu.
Im lepiej opiszesz cel, kontekst i format, tym trafniejszą odpowiedź dostaniesz.
⚡ W praktyce: "Napisz email do klienta w tonie profesjonalnym, max 120 słów" to prompt.
🔗 Powiązane: system prompt, few-shot, kontekst, format`;
  }

  return `📖 **Tryb awaryjny słownika**
Prosty opis: Google Gemini chwilowo odrzucił zapytanie z powodu limitu, więc pokazuję lokalną odpowiedź zastępczą.
To jak zapasowa notatka w zeszycie, gdy internet w bibliotece przestaje działać.
⚡ W praktyce: Odczekaj chwilę i wyślij pytanie ponownie, a agent wróci do odpowiedzi z modelu AI.
🔗 Powiązane: limit API, Gemini, fallback, Google AI Studio`;
}

function enqueueTextResponse(
  controller: ReadableStreamDefaultController<UIMessageChunk>,
  text: string,
) {
  const id = `fewshot-offline-${Date.now()}`;

  controller.enqueue({ type: "start" });
  controller.enqueue({ type: "start-step" });
  controller.enqueue({ type: "text-start", id });
  controller.enqueue({ type: "text-delta", id, delta: text });
  controller.enqueue({ type: "text-end", id });
  controller.enqueue({ type: "finish-step" });
  controller.enqueue({ type: "finish", finishReason: "stop" });
}

async function streamGeminiResponse({
  controller,
  modelMessages,
}: {
  controller: ReadableStreamDefaultController<UIMessageChunk>;
  modelMessages: ModelMessage[];
}) {
  const result = streamText({
    model: google("gemini-3.1-flash-lite"),
    system: systemPrompt,
    messages: modelMessages,
    stopWhen: stepCountIs(maxSteps),
  });

  for await (const part of result.stream) {
    if (part.type === "error") {
      throw part.error;
    }

    const chunk = toUIMessageChunk(part, {
      onError: getErrorText,
    });

    if (chunk) {
      controller.enqueue(chunk);
    }
  }
}

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();
  const modelMessages = await convertToModelMessages(messages);
  const lastUserText = getLastUserText(messages);

  const stream = new ReadableStream<UIMessageChunk>({
    async start(controller) {
      try {
        await streamGeminiResponse({ controller, modelMessages });
        controller.close();
      } catch (error) {
        if (isQuotaError(error)) {
          enqueueTextResponse(controller, getOfflineDefinition(lastUserText));
          controller.close();
          return;
        }

        controller.enqueue({
          type: "error",
          errorText: getErrorText(error),
        });
        controller.close();
      }
    },
  });

  return createUIMessageStreamResponse({
    stream,
  });
}
