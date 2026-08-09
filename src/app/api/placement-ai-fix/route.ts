import { NextRequest } from "next/server";
import {
  buildPlacementAiPrompt,
  runOpenAiPlacementFix,
  type PlacementAiFixBody,
} from "@/lib/placement-import/ai-fix";

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return Response.json(
      {
        error:
          "OPENAI_API_KEY is not set on the server. Offline edit still works in the app.",
      },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => null)) as PlacementAiFixBody | null;
  if (!body || !Array.isArray(body.rows)) {
    return Response.json({ error: "Expected { rows, note?, chips? }" }, { status: 400 });
  }

  const note = String(body.note ?? "").trim();
  const chips = Array.isArray(body.chips) ? body.chips : [];
  if (!note && chips.length === 0) {
    return Response.json({ error: "Provide a note or issue chips." }, { status: 400 });
  }

  try {
    const prompt = buildPlacementAiPrompt(body);
    const result = await runOpenAiPlacementFix(prompt, apiKey);
    return Response.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "AI fix failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
