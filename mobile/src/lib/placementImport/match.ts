export type ExistingFarmRef = {
  id: string;
  farmName: string;
  farmNumber: string | null;
};

export type PlacementFarmMatch = {
  kind: "exact" | "code" | "fuzzy" | "none";
  farm: ExistingFarmRef | null;
  nameDiffers: boolean;
};

export function normalizeFarmName(name: string) {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
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
  if (na.includes(nb) || nb.includes(na)) {
    return Math.min(na.length, nb.length) / Math.max(na.length, nb.length);
  }
  return 1 - levenshtein(na, nb) / Math.max(na.length, nb.length);
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
      nameDiffers: normalizeFarmName(byCode.farmName) !== normalizeFarmName(farmName),
    };
  }
  const exact = existing.find(
    (f) => normalizeFarmName(f.farmName) === normalizeFarmName(farmName),
  );
  if (exact) return { kind: "exact", farm: exact, nameDiffers: false };

  let best: ExistingFarmRef | null = null;
  let bestScore = 0;
  for (const farm of existing) {
    const score = nameSimilarity(farm.farmName, farmName);
    if (score > bestScore) {
      bestScore = score;
      best = farm;
    }
  }
  if (best && bestScore >= 0.78) {
    return {
      kind: "fuzzy",
      farm: best,
      nameDiffers: normalizeFarmName(best.farmName) !== normalizeFarmName(farmName),
    };
  }
  return { kind: "none", farm: null, nameDiffers: false };
}
