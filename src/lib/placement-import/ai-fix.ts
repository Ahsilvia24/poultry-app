export type PlacementAiRow = {
  datePlaced: string;
  farmCode: string;
  farmName: string;
  flockId: string;
  houseNo: number;
  numberSent: number;
};

export type PlacementAiFixBody = {
  note?: string;
  chips?: string[];
  rows?: PlacementAiRow[];
  pdfSample?: string | null;
  expectedRows?: number | null;
};

function normalizeRow(r: Partial<PlacementAiRow>): PlacementAiRow | null {
  const farmCode = String(r.farmCode ?? "")
    .trim()
    .toUpperCase();
  const farmName = String(r.farmName ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (!farmCode && !farmName) return null;
  const houseNo = Math.max(1, Math.floor(Number(r.houseNo) || 1));
  const numberSent = Math.max(0, Math.floor(Number(r.numberSent) || 0));
  if (!(numberSent > 0)) return null;
  const datePlaced = String(r.datePlaced ?? "").trim().slice(0, 10);
  return {
    farmCode,
    farmName: farmName || farmCode,
    // App flock id = farm code left of name (ignore sheet flock column).
    flockId: farmCode || `H${houseNo}`,
    houseNo,
    numberSent,
    datePlaced: /^\d{4}-\d{2}-\d{2}$/.test(datePlaced)
      ? datePlaced
      : new Date().toISOString().slice(0, 10),
  };
}

export function sanitizeAiPlacementRows(raw: unknown): PlacementAiRow[] {
  if (!Array.isArray(raw)) return [];
  const out: PlacementAiRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = normalizeRow(item as Partial<PlacementAiRow>);
    if (row) out.push(row);
  }
  return out;
}

export function buildPlacementAiPrompt(input: PlacementAiFixBody): string {
  const rows = Array.isArray(input.rows) ? input.rows : [];
  const chips = Array.isArray(input.chips) ? input.chips : [];
  return [
    "You fix Weekly Chick Placement import rows for a poultry app.",
    "Keep only: farmName, farmCode (code LEFT of farm name, e.g. 3821FS), houseNo, datePlaced (YYYY-MM-DD), numberSent.",
    "IGNORE Complex (2601HV), sheet Flock Code (FS26045), mortality, in-transit, and far-right day counts.",
    "flockId must equal farmCode.",
    "User issue chips: " + (chips.join(", ") || "(none)"),
    "User note: " + (String(input.note ?? "").trim() || "(none)"),
    "Expected houses hint: " + String(input.expectedRows ?? "unknown"),
    input.pdfSample ? "PDF extract sample:\n" + String(input.pdfSample).slice(0, 6000) : "",
    "Current rows JSON:",
    JSON.stringify(rows.slice(0, 120)),
    'Respond with ONLY JSON: {"summary":"short what you changed","rows":[{farmCode,farmName,houseNo,datePlaced,numberSent,flockId}]}',
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function runOpenAiPlacementFix(prompt: string, apiKey: string) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a careful data cleaner for Weekly Chick Placement PDFs. Return valid JSON only.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenAI failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  const parsed = JSON.parse(content) as { summary?: string; rows?: unknown };
  const rows = sanitizeAiPlacementRows(parsed.rows);
  if (rows.length === 0) throw new Error("Model returned no usable rows");
  return {
    summary: String(parsed.summary ?? "Updated placement rows.").trim(),
    rows,
  };
}
