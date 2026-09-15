export type PhoneFarmSaveKind = "checking" | "saving" | "unsaved" | "saved";

export function phoneFarmSaveStatus(input: {
  ready: boolean;
  syncing: boolean;
  pendingCount: number;
}): { kind: PhoneFarmSaveKind; text: string } {
  if (!input.ready) {
    return { kind: "checking", text: "Checking farm saves on this phone…" };
  }
  if (input.pendingCount > 0 && input.syncing) {
    return { kind: "saving", text: "Saving farm work from this phone…" };
  }
  if (input.pendingCount > 0) {
    return {
      kind: "unsaved",
      text: "This phone still has farm work that has not uploaded. Sign out will delete it.",
    };
  }
  return { kind: "saved", text: "All farm work on this phone is saved." };
}

export const SIGN_OUT_UNSAVED_CONFIRM =
  "This phone still has farm work that has not uploaded. Sign out deletes that work from this phone. Sign out anyway?";
