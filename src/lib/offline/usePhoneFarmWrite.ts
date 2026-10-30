"use client";

import { useRef, useState } from "react";
import { useOffline } from "@/components/OfflineProvider";
import type { OfflineFormWrite } from "@/lib/offline/types";

const FAIL = "Could not update this farm on this phone. Try again.";

/** Apply a farm status write on the phone. Does not wait on the website. */
export function usePhoneFarmWrite() {
  const { commitLocalWrite } = useOffline();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);

  function clear() {
    setError(null);
  }

  async function commit(write: OfflineFormWrite) {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const wrote = await commitLocalWrite(write);
      if (!wrote) {
        setError(FAIL);
        return false;
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : FAIL);
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return { busy, error, commit, clear };
}
