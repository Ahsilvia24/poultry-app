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

export function matchPlacementFarm(
  farmName: string,
  farmCode: string,
  existing: ExistingFarmRef[],
): PlacementFarmMatch {
  const code = farmCode.trim().toUpperCase();
  const byCode = code
    ? existing.find((f) => (f.farmNumber ?? "").trim().toUpperCase() === code)
    : undefined;
  if (byCode) {
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
