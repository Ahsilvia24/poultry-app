import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  isPlausibleFarmName,
  normalizePlacementRow,
  rejectJunkPlacementRows,
  type PlacementRow,
} from "./parse";

const LESSONS_KEY = "placement_parse_lessons_v1";
const MAX_LESSONS = 40;

export type PlacementParseLesson = {
  id: string;
  at: string;
  note: string;
  /** Exact farm names (upper) that should never import. */
  rejectNames: string[];
  /** Confirmed farms from a good AI/manual fix. */
  knownFarms: Array<{ farmCode: string; farmName: string }>;
  /** Short tip injected into future AI prompts. */
  tip: string;
};

let lessonCache: PlacementParseLesson[] = [];

export function getPlacementLessonCache(): PlacementParseLesson[] {
  return lessonCache;
}

export function setPlacementLessonCache(lessons: PlacementParseLesson[]) {
  lessonCache = lessons;
}

export async function loadPlacementLessons(): Promise<PlacementParseLesson[]> {
  try {
    const raw = await AsyncStorage.getItem(LESSONS_KEY);
    if (!raw) {
      lessonCache = [];
      return [];
    }
    const parsed = JSON.parse(raw) as PlacementParseLesson[];
    lessonCache = Array.isArray(parsed) ? parsed : [];
    return lessonCache;
  } catch {
    lessonCache = [];
    return [];
  }
}

export async function savePlacementLesson(lesson: PlacementParseLesson): Promise<void> {
  const next = [lesson, ...lessonCache.filter((l) => l.id !== lesson.id)].slice(0, MAX_LESSONS);
  lessonCache = next;
  await AsyncStorage.setItem(LESSONS_KEY, JSON.stringify(next));
}

export function lessonsRejectNameSet(lessons = lessonCache): Set<string> {
  const set = new Set<string>();
  for (const lesson of lessons) {
    for (const name of lesson.rejectNames) set.add(name.toUpperCase());
  }
  return set;
}

export function lessonsPromptTips(lessons = lessonCache): string {
  const tips = lessons
    .map((l) => l.tip)
    .filter(Boolean)
    .slice(0, 12);
  if (!tips.length) return "";
  return "Learned offline tips from prior AI fixes:\n- " + tips.join("\n- ");
}

/** Apply saved lessons after a parse (drop learned junk names). */
export function applyPlacementLessonsToRows(
  rows: PlacementRow[],
  lessons = lessonCache,
): PlacementRow[] {
  const reject = lessonsRejectNameSet(lessons);
  return rejectJunkPlacementRows(rows).filter((row) => {
    if (reject.has(row.farmName.trim().toUpperCase())) return false;
    return isPlausibleFarmName(row.farmName);
  });
}

/**
 * Build a lesson from before/after AI (or manual) corrections so the next
 * offline parse gets smarter on this device.
 */
export function buildLessonFromCorrection(input: {
  before: PlacementRow[];
  after: PlacementRow[];
  note: string;
}): PlacementParseLesson | null {
  const beforeNames = new Set(input.before.map((r) => r.farmName.trim().toUpperCase()));
  const afterNames = new Set(input.after.map((r) => r.farmName.trim().toUpperCase()));
  const rejectNames = [...beforeNames].filter((n) => !afterNames.has(n) && n.length >= 2);

  const knownFarmsMap = new Map<string, string>();
  for (const row of input.after) {
    const code = row.farmCode.trim().toUpperCase();
    if (!code || code === "2601HV") continue;
    if (!isPlausibleFarmName(row.farmName)) continue;
    knownFarmsMap.set(code, row.farmName.trim());
  }
  const knownFarms = [...knownFarmsMap.entries()].map(([farmCode, farmName]) => ({
    farmCode,
    farmName,
  }));

  if (rejectNames.length === 0 && knownFarms.length === 0) return null;

  const tipParts: string[] = [];
  if (rejectNames.length) {
    tipParts.push(`Never treat these as farm names: ${rejectNames.slice(0, 8).join(", ")}`);
  }
  if (input.note.trim()) tipParts.push(`User said: ${input.note.trim().slice(0, 160)}`);
  tipParts.push(
    "Ignore Complex 2601HV, sheet flock codes FS/HV#####, header Ref/FSP1/Wk No, far-right mortality.",
  );

  return {
    id: `lesson_${Date.now().toString(36)}`,
    at: new Date().toISOString(),
    note: input.note.trim().slice(0, 240),
    rejectNames,
    knownFarms: knownFarms.slice(0, 40),
    tip: tipParts.join(" | "),
  };
}

export function normalizeCorrectedRows(rows: PlacementRow[]): PlacementRow[] {
  return applyPlacementLessonsToRows(
    rows
      .map((r) => normalizePlacementRow(r))
      .filter((r): r is PlacementRow => Boolean(r)),
  );
}
