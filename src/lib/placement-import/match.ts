import type {
  ExistingFarmRef,
  FarmMatchKind,
  PlacementFarmMatch,
} from "@/lib/placement-import/types";

/** Spaced, uppercased tokens for readable compare. */
export function normalizeFarmName(name: string) {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Letters/digits only — so "goldstar" and "GOLD STAR" compare equal. */
export function compactFarmName(name: string) {
  return name.toUpperCase().replace(/[^A-Z0-9]+/g, "");
}

const TRAILING_NOISE =
  /\b(FARMS?|LLC|INC|INCORPORATED|CO|COMPANY|POULTRY|BROILERS?)\b/g;

/** Core name with common business suffixes removed. */
export function coreFarmName(name: string) {
  const normalized = normalizeFarmName(name).replace(TRAILING_NOISE, " ").replace(/\s+/g, " ").trim();
  return compactFarmName(normalized || name);
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,
        dp[i]![j - 1]! + 1,
        dp[i - 1]![j - 1]! + cost,
      );
    }
  }
  return dp[m]![n]!;
}

export function nameSimilarity(a: string, b: string): number {
  const na = normalizeFarmName(a);
  const nb = normalizeFarmName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;

  const ca = compactFarmName(a);
  const cb = compactFarmName(b);
  if (ca && ca === cb) return 0.99;

  const coreA = coreFarmName(a);
  const coreB = coreFarmName(b);
  if (coreA && coreA === coreB) return 0.97;

  let score = 0;

  if (ca.includes(cb) || cb.includes(ca)) {
    const shorter = Math.min(ca.length, cb.length);
    const longer = Math.max(ca.length, cb.length);
    if (longer > 0 && shorter / longer >= 0.75) score = Math.max(score, shorter / longer);
  }

  if (na.includes(nb) || nb.includes(na)) {
    const shorter = Math.min(na.length, nb.length);
    const longer = Math.max(na.length, nb.length);
    score = Math.max(score, shorter / longer);
  }

  const compactDist = levenshtein(ca, cb);
  const compactLonger = Math.max(ca.length, cb.length) || 1;
  score = Math.max(score, 1 - compactDist / compactLonger);

  const dist = levenshtein(na, nb);
  const longer = Math.max(na.length, nb.length);
  score = Math.max(score, 1 - dist / longer);

  // Shared suffixes (FARMS / POULTRY) must not make short distinct names
  // look alike — e.g. "DMD Farms" vs "RED Farms".
  if (coreA && coreB && coreA !== coreB) {
    const coreLonger = Math.max(coreA.length, coreB.length) || 1;
    const coreScore = 1 - levenshtein(coreA, coreB) / coreLonger;
    if (Math.min(coreA.length, coreB.length) <= 4) {
      score = Math.min(score, coreScore);
    }
  }

  return score;
}

function displayNameDiffers(existingName: string, importedName: string) {
  return existingName.trim() !== importedName.trim();
}

/** True when short acronym-style cores clearly disagree (DMD vs RED). */
export function shortCoresConflict(a: string, b: string): boolean {
  const coreA = coreFarmName(a);
  const coreB = coreFarmName(b);
  if (!coreA || !coreB || coreA === coreB) return false;
  if (Math.min(coreA.length, coreB.length) > 4) return false;
  const coreLonger = Math.max(coreA.length, coreB.length) || 1;
  const coreScore = 1 - levenshtein(coreA, coreB) / coreLonger;
  return coreScore < 0.8;
}

function matchRank(
  farmName: string,
  farmCode: string,
  match: PlacementFarmMatch,
): number {
  if (!match.farm) return 0;
  const sim = nameSimilarity(match.farm.farmName, farmName);
  if (match.kind === "exact") return 300 + sim;
  if (match.kind === "code") {
    const code = farmCode.trim().toUpperCase();
    const existingCode = (match.farm.farmNumber ?? "").trim().toUpperCase();
    return 200 + sim + (code && code === existingCode ? 0.5 : 0);
  }
  if (match.kind === "fuzzy") return 100 + sim;
  return 0;
}

export function matchPlacementFarm(
  farmName: string,
  farmCode: string,
  existing: ExistingFarmRef[],
): PlacementFarmMatch {
  const code = farmCode.trim().toUpperCase();
  const byCode = code
    ? existing.find((f) => (f.farmNumber ?? "").trim().toUpperCase() === code)
    : undefined;
  // Farm numbers can be stale/wrong — never let a code override clearly
  // different short names like DMD vs RED.
  if (byCode && !shortCoresConflict(byCode.farmName, farmName)) {
    return {
      kind: "code",
      farm: byCode,
      nameDiffers: displayNameDiffers(byCode.farmName, farmName),
    };
  }

  const exact = existing.find(
    (f) => normalizeFarmName(f.farmName) === normalizeFarmName(farmName),
  );
  if (exact) {
    return {
      kind: "exact",
      farm: exact,
      nameDiffers: displayNameDiffers(exact.farmName, farmName),
    };
  }

  const compactHit = existing.find(
    (f) => compactFarmName(f.farmName) === compactFarmName(farmName) && compactFarmName(farmName),
  );
  if (compactHit) {
    return {
      kind: "fuzzy",
      farm: compactHit,
      nameDiffers: displayNameDiffers(compactHit.farmName, farmName),
    };
  }

  const coreHit = existing.find(
    (f) => coreFarmName(f.farmName) === coreFarmName(farmName) && coreFarmName(farmName),
  );
  if (coreHit) {
    return {
      kind: "fuzzy",
      farm: coreHit,
      nameDiffers: displayNameDiffers(coreHit.farmName, farmName),
    };
  }

  let best: ExistingFarmRef | null = null;
  let bestScore = 0;
  for (const farm of existing) {
    const score = nameSimilarity(farm.farmName, farmName);
    if (score > bestScore) {
      bestScore = score;
      best = farm;
    }
  }

  if (best && bestScore >= 0.72) {
    return {
      kind: "fuzzy",
      farm: best,
      nameDiffers: displayNameDiffers(best.farmName, farmName),
    };
  }

  return { kind: "none" satisfies FarmMatchKind, farm: null, nameDiffers: false };
}

/**
 * Match imported farm groups to existing farms with a 1:1 assignment.
 * Prevents two imports (e.g. DMD and RED) from claiming the same farm.
 */
export function matchPlacementFarmGroups(
  groups: Array<{ farmName: string; farmCode: string }>,
  existing: ExistingFarmRef[],
): PlacementFarmMatch[] {
  const results: PlacementFarmMatch[] = groups.map(() => ({
    kind: "none" as FarmMatchKind,
    farm: null,
    nameDiffers: false,
  }));
  const claimed = new Set<string>();
  const assigned = new Set<number>();

  while (true) {
    let best: { index: number; match: PlacementFarmMatch; rank: number } | null = null;
    for (let i = 0; i < groups.length; i++) {
      if (assigned.has(i)) continue;
      const group = groups[i]!;
      const available = existing.filter((f) => !claimed.has(f.id));
      const match = matchPlacementFarm(group.farmName, group.farmCode, available);
      if (!match.farm) continue;
      const rank = matchRank(group.farmName, group.farmCode, match);
      if (!best || rank > best.rank) best = { index: i, match, rank };
    }
    if (!best?.match.farm) break;
    results[best.index] = best.match;
    assigned.add(best.index);
    claimed.add(best.match.farm.id);
  }

  return results;
}
