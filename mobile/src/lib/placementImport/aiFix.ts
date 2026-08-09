import Constants from "expo-constants";
import {
  applyLocalPlacementInstructions,
  normalizePlacementRow,
  type PlacementRow,
} from "./parse";
import {
  buildLessonFromCorrection,
  lessonsPromptTips,
  normalizeCorrectedRows,
  savePlacementLesson,
} from "./learn";
import {
  deleteSessionItem,
  getSessionItem,
  setSessionItem,
} from "../sessionStore";

export type PlacementAiFixRequest = {
  note: string;
  chips: string[];
  rows: PlacementRow[];
  /** Optional PDF extract sample to help the model (truncated). */
  pdfSample?: string | null;
  expectedRows?: number | null;
};

export type PlacementAiFixResult = {
  rows: PlacementRow[];
  summary: string;
  source: "openai" | "server" | "local";
  learned?: boolean;
};

export { applyLocalPlacementInstructions };

const AI_KEY_STORE = "placement_openai_api_key";
let cachedOpenAiKey = "";

export async function loadPlacementAiKey(): Promise<string> {
  try {
    const fromEnv = readEnv("EXPO_PUBLIC_OPENAI_API_KEY");
    if (fromEnv) {
      cachedOpenAiKey = fromEnv;
      return fromEnv;
    }
    const saved = (await getSessionItem(AI_KEY_STORE))?.trim() ?? "";
    cachedOpenAiKey = saved;
    return saved;
  } catch {
    return cachedOpenAiKey;
  }
}

export async function savePlacementAiKey(key: string): Promise<void> {
  const trimmed = key.trim();
  cachedOpenAiKey = trimmed;
  if (!trimmed) {
    await deleteSessionItem(AI_KEY_STORE);
    return;
  }
  await setSessionItem(AI_KEY_STORE, trimmed);
}

export function getCachedPlacementAiKey(): string {
  return cachedOpenAiKey || readEnv("EXPO_PUBLIC_OPENAI_API_KEY");
}

function expoExtra(): Record<string, unknown> {
  const extra =
    (Constants.expoConfig?.extra as Record<string, unknown> | undefined) ||
    ((Constants as unknown as { manifest?: { extra?: Record<string, unknown> } }).manifest
      ?.extra ??
      {});
  return extra ?? {};
}

function readEnv(name: string): string {
  const fromProcess =
    typeof process !== "undefined" && process.env ? String(process.env[name] ?? "") : "";
  if (fromProcess.trim()) return fromProcess.trim();
  const extra = expoExtra();
  const v = extra[name];
  return typeof v === "string" ? v.trim() : "";
}

/** True when an online AI path is configured (saved key, env key, or server URL). */
export function canUseOnlinePlacementAi(): boolean {
  return Boolean(
    getCachedPlacementAiKey() ||
      readEnv("EXPO_PUBLIC_OPENAI_API_KEY") ||
      readEnv("EXPO_PUBLIC_PLACEMENT_AI_URL"),
  );
}

function sanitizeRows(raw: unknown): PlacementRow[] {
  if (!Array.isArray(raw)) return [];
  const out: PlacementRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const row = normalizePlacementRow({
      farmCode: String(r.farmCode ?? ""),
      farmName: String(r.farmName ?? ""),
      datePlaced: String(r.datePlaced ?? ""),
      houseNo: Number(r.houseNo),
      numberSent: Number(r.numberSent),
      flockId: String(r.farmCode ?? ""),
    });
    if (row && row.numberSent > 0 && row.farmName) out.push(row);
  }
  return normalizeCorrectedRows(out);
}

function buildPrompt(input: PlacementAiFixRequest): string {
  const summary = {
    farmCount: new Set(input.rows.map((r) => r.farmCode)).size,
    rowCount: input.rows.length,
    expectedRows: input.expectedRows ?? null,
  };
  const learned = lessonsPromptTips();
  return [
    "You fix Weekly Chick Placement import rows for a poultry app.",
    "Keep only: farmName, farmCode (code LEFT of farm name, e.g. 3821FS), houseNo, datePlaced (YYYY-MM-DD), numberSent.",
    "IGNORE Complex (2601HV), sheet Flock Code (FS26045), mortality, in-transit, and far-right day counts.",
    "IGNORE header crumbs like Ref. / FSP1 / Wk No. — never use those as farm names.",
    "flockId must equal farmCode.",
    learned,
    "User issue chips: " + (input.chips.join(", ") || "(none)"),
    "User note: " + (input.note.trim() || "(none)"),
    "Current summary: " + JSON.stringify(summary),
    input.pdfSample ? "PDF extract sample:\n" + input.pdfSample.slice(0, 6000) : "",
    "Current rows JSON:",
    JSON.stringify(input.rows.slice(0, 120)),
    'Respond with ONLY JSON: {"summary":"short what you changed","rows":[{farmCode,farmName,houseNo,datePlaced,numberSent,flockId}]}',
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function callOpenAi(prompt: string, apiKey: string): Promise<PlacementAiFixResult> {
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
            "You are a careful data cleaner for Weekly Chick Placement PDFs. Return valid JSON only. Never invent header text (Ref/FSP1/Wk No) as farm names.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI request failed (${res.status}). ${text.slice(0, 180)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  let parsed: { summary?: string; rows?: unknown };
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("AI returned unreadable JSON.");
  }
  const rows = sanitizeRows(parsed.rows);
  if (rows.length === 0) throw new Error("AI returned no usable placement rows.");
  return {
    rows,
    summary: String(parsed.summary ?? "Updated rows from your note.").trim(),
    source: "openai",
  };
}

async function callServer(input: PlacementAiFixRequest, url: string): Promise<PlacementAiFixResult> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...input,
      learnedTips: lessonsPromptTips(),
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI server failed (${res.status}). ${text.slice(0, 180)}`);
  }
  const data = (await res.json()) as { summary?: string; rows?: unknown };
  const rows = sanitizeRows(data.rows);
  if (rows.length === 0) throw new Error("AI server returned no usable rows.");
  return {
    rows,
    summary: String(data.summary ?? "Updated rows from your note.").trim(),
    source: "server",
  };
}

async function rememberCorrection(
  before: PlacementRow[],
  after: PlacementRow[],
  note: string,
): Promise<boolean> {
  const lesson = buildLessonFromCorrection({ before, after, note });
  if (!lesson) return false;
  await savePlacementLesson(lesson);
  return true;
}

/** Online AI fix when configured; otherwise tries local typed instructions. */
export async function requestPlacementAiFix(
  input: PlacementAiFixRequest,
): Promise<PlacementAiFixResult> {
  const note = input.note.trim();
  if (!note && input.chips.length === 0) {
    throw new Error("Type what’s wrong, or tap an issue chip, then try again.");
  }

  await loadPlacementAiKey();
  const serverUrl = readEnv("EXPO_PUBLIC_PLACEMENT_AI_URL");
  const openAiKey = getCachedPlacementAiKey();
  const prompt = buildPrompt(input);
  const before = input.rows;

  if (serverUrl) {
    try {
      const result = await callServer(input, serverUrl);
      result.learned = await rememberCorrection(before, result.rows, note);
      return result;
    } catch (e) {
      if (!openAiKey) throw e;
    }
  }

  if (openAiKey) {
    try {
      const result = await callOpenAi(prompt, openAiKey);
      result.learned = await rememberCorrection(before, result.rows, note);
      return result;
    } catch (e) {
      const local = applyLocalPlacementInstructions(input.rows, note);
      if (local) {
        const rows = normalizeCorrectedRows(local.rows);
        const learned = await rememberCorrection(before, rows, note);
        return { ...local, rows, learned };
      }
      throw e;
    }
  }

  const local = applyLocalPlacementInstructions(input.rows, note);
  if (local) {
    const rows = normalizeCorrectedRows(local.rows);
    const learned = await rememberCorrection(before, rows, note);
    return { ...local, rows, learned };
  }

  throw new Error(
    "Add your OpenAI API key below (saved on this phone), then tap Ask AI. Or use short offline commands like: remove farm MERCY FARM",
  );
}
