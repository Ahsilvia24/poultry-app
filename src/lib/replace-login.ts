export function replaceLoginStatus(input: {
  activeSessionId: string | null | undefined;
  unsyncedAt: Date | string | null | undefined;
  currentSessionId?: string | null;
  activeDeviceId?: string | null;
  currentDeviceId?: string | null;
  sameBrowser?: boolean;
}) {
  if (!input.activeSessionId) {
    return { otherDevice: false, unsynced: false, knownOtherDevice: false };
  }
  if (input.sameBrowser) {
    return { otherDevice: false, unsynced: false, knownOtherDevice: false };
  }
  if (input.currentSessionId && input.currentSessionId === input.activeSessionId) {
    return { otherDevice: false, unsynced: false, knownOtherDevice: false };
  }
  if (
    input.currentDeviceId &&
    input.activeDeviceId &&
    input.currentDeviceId === input.activeDeviceId
  ) {
    return { otherDevice: false, unsynced: false, knownOtherDevice: false };
  }
  const knownOtherDevice = Boolean(
    input.currentDeviceId &&
      input.activeDeviceId &&
      input.currentDeviceId !== input.activeDeviceId,
  );
  return {
    otherDevice: true,
    unsynced: Boolean(input.unsyncedAt),
    knownOtherDevice,
  };
}

export function replaceLoginWarning(unsynced: boolean, knownOtherDevice = false) {
  if (knownOtherDevice) {
    if (unsynced) {
      return "This account is already signed in on another phone, and that phone still has work that has not uploaded. Signing in here will sign it out. Work that has not synced may be lost.";
    }
    return "This account is already signed in on another phone. Signing in here will sign it out. If that phone has work that has not uploaded, it may be lost.";
  }
  if (unsynced) {
    return "This account still has a sign-in open, and that session still has work that has not uploaded. Signing in here will replace it. Work that has not synced may be lost.";
  }
  return "This account still has a sign-in open. Signing in here will replace that session.";
}
