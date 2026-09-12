export function replaceLoginStatus(input: {
  activeSessionId: string | null | undefined;
  unsyncedAt: Date | string | null | undefined;
  currentSessionId?: string | null;
}) {
  if (!input.activeSessionId) return { otherDevice: false, unsynced: false };
  if (input.currentSessionId && input.currentSessionId === input.activeSessionId) {
    return { otherDevice: false, unsynced: false };
  }
  return { otherDevice: true, unsynced: Boolean(input.unsyncedAt) };
}

export function replaceLoginWarning(unsynced: boolean) {
  if (unsynced) {
    return "This account is already signed in on another phone, and that phone still has work that has not uploaded. Signing in here will sign it out. Work that has not synced may be lost.";
  }
  return "This account is already signed in on another phone. Signing in here will sign it out. If that phone has work that has not uploaded, it may be lost.";
}
