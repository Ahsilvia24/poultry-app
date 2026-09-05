/** Local SQLite write tracking — kept free of DB imports to avoid cycles. */

let syncing = false;
let dirty = false;
let listener: (() => void) | null = null;

export function setSyncing(value: boolean) {
  syncing = value;
}

export function isSyncing() {
  return syncing;
}

export function isDirty() {
  return dirty;
}

export function clearDirty() {
  dirty = false;
}

export function markDirty() {
  if (syncing) return;
  dirty = true;
  listener?.();
}

export function noteSql(source: string) {
  if (syncing) return;
  if (/^\s*(INSERT|UPDATE|DELETE)\b/i.test(source)) markDirty();
}

export function onDirty(fn: (() => void) | null) {
  listener = fn;
}
