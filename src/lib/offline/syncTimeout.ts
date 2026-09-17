export const SNAPSHOT_TIMEOUT_MS = 20_000;
export const WRITE_TIMEOUT_MS = 20_000;
export const FLUSH_BUDGET_MS = 45_000;
export const SYNC_OVERALL_MS = 70_000;
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
