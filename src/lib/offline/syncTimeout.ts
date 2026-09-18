export const SNAPSHOT_TIMEOUT_MS = 20_000;
export const WRITE_TIMEOUT_MS = 12_000;
export const FLUSH_BUDGET_MS = 15_000;
export const SYNC_OVERALL_MS = 15_000;
export const SYNC_UI_MS = 12_000;
export const SIGN_OUT_FLUSH_MS = 4_000;
export const LOGOUT_FETCH_MS = 2_000;
export const SIGN_OUT_OVERALL_MS = 4_000;
export const SYNC_TIMEOUT_MARK = "SYNC_TIMEOUT";

export const SYNC_WRITE_TIMEOUT =
  "Could not upload this farm work. Stay on Wi-Fi and tap Sync data again.";

export function isSyncTimeout(error: unknown) {
  return error instanceof Error && error.message === SYNC_TIMEOUT_MARK;
}

/** Reject if `work` has not settled. The original promise may still be in flight. */
export function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(SYNC_TIMEOUT_MARK));
    }, ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
