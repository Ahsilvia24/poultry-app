export type FlockNumberPlan =
  | { type: "keep" }
  | { type: "rename" }
  | { type: "move"; flockId: string }
  | { type: "create" };

/**
 * How to apply a typed Flock ID on one house.
 * Earlier houses on a shared flock stay put; this house (and propagate
 * targets, applied one-by-one) move to the new ID.
 */
export function planFlockNumberChange(input: {
  nextNumber: string;
  currentFlockNumber: string;
  currentFlockId: string;
  otherHousesOnCurrentFlock: number;
  existingFlockIdWithNumber: string | null;
}): FlockNumberPlan {
  const next = input.nextNumber.trim();
  if (!next) return { type: "keep" };
  if (next === input.currentFlockNumber.trim()) return { type: "keep" };
  const existing = input.existingFlockIdWithNumber;
  if (existing && existing !== input.currentFlockId) {
    return { type: "move", flockId: existing };
  }
  if (input.otherHousesOnCurrentFlock <= 0) return { type: "rename" };
  return { type: "create" };
}
