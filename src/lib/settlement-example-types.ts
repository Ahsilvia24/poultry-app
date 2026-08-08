export type SettlementExampleMeta = {
  id: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  uploadedByUserId: string;
};

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
