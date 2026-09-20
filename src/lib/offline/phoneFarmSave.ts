export type PhoneFarmSaveKind = "checking" | "saving" | "unsaved" | "saved";

export function phoneFarmSaveStatus(input: {
  ready: boolean;
  syncing: boolean;
  pendingCount: number;
  lastBackupAt?: string | null;
}): { kind: PhoneFarmSaveKind; text: string } {
  if (!input.ready) {
    return { kind: "checking", text: "Checking farm saves on this phone…" };
  }
  if (input.syncing) {
    return { kind: "saving", text: "Saving a backup of this phone’s farms…" };
  }
  if (input.lastBackupAt) {
    return {
      kind: "saved",
      text: `Farms are saved on this phone. Last automatic backup ${formatBackupClock(input.lastBackupAt)}.`,
    };
  }
  return { kind: "saved", text: "Farms are saved on this phone. Sign out keeps them here." };
}

function formatBackupClock(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "just now";
  return date.toLocaleString();
}

export const SIGN_OUT_UNSAVED_BODY =
  "Sign out leaves the farms on this phone. Save a backup file if you might switch phones.";
export const SIGN_OUT_UNSAVED_CONFIRM = `${SIGN_OUT_UNSAVED_BODY} Sign out now?`;
export const SIGN_OUT_ANYWAY = "Sign out";
export const SIGN_OUT_STAY = "Stay signed in";
