import type { OfflineSnapshot } from "@/lib/offline/types";

export const GET_WEBSITE_FARMS = "Get farms from website";
export const GET_WEBSITE_WORKING = "Getting website farms…";
export const GET_WEBSITE_UNAVAILABLE =
  "Website farms are not available yet. Try again after the farm database unlocks.";
export const GET_WEBSITE_EMPTY = "No website farms for this email yet.";
export const GET_WEBSITE_NONE_NEW = "Website farms are already on this phone.";
export const GET_WEBSITE_PHONE_OWNS =
  "This phone already has farms. Export all app data on the other phone, then import that file here.";

export type PullWebsiteFarmsResult =
  | { ok: true; added: number; total: number; snapshot: OfflineSnapshot }
  | { ok: false; reason: "unavailable" | "empty" | "phone-owns" };

export function pullWebsiteFarmsMessage(result: PullWebsiteFarmsResult) {
  if (!result.ok) {
    if (result.reason === "empty") return GET_WEBSITE_EMPTY;
    if (result.reason === "phone-owns") return GET_WEBSITE_PHONE_OWNS;
    return GET_WEBSITE_UNAVAILABLE;
  }
  if (result.added === 0) return GET_WEBSITE_NONE_NEW;
  return `Added ${result.added} farm${result.added === 1 ? "" : "s"} from the website. Your phone farms are still here.`;
}

/** Website farms never write onto this phone. */
export async function pullWebsiteFarms(_ownerEmail?: string): Promise<PullWebsiteFarmsResult> {
  return { ok: false, reason: "phone-owns" };
}
