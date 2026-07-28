import { z } from "zod";
import { requireAuthenticatedUser } from "../../../lib/supabaseServer.server";
import { crawlBatrea } from "../../../lib/batreaHeadlessCrawler.server";

export const runtime = "nodejs";
export const maxDuration = 60;
const schema = z.object({ maxProducts: z.number().int().min(1).max(20).default(20) });

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request).catch(() => null);
  if (!auth) return Response.json({ error: "Wymagane jest zalogowanie." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "maxProducts musi być liczbą od 1 do 20." }, { status: 400 });
  try { return Response.json(await crawlBatrea(parsed.data.maxProducts)); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Crawler nie ukończył pracy." }, { status: 500 }); }
}
