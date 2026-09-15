/**
 * Browser / phone extract. unpdf ships an inlined pdf.js worker, so a
 * Placement or Catch PDF can be read with no network after the app JS is saved.
 */
function copyBytes(bytes: Uint8Array): Uint8Array {
  return Uint8Array.from(bytes);
}

export async function extractPdfTextsOnDevice(bytes: Uint8Array): Promise<string[]> {
  const { extractText, extractTextItems, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(copyBytes(bytes));
  try {
    const texts: string[] = [];
    const merged = await extractText(pdf, { mergePages: true });
    if (merged.text.trim()) texts.push(merged.text);
    const structured = await extractTextItems(pdf);
    const pages = structured.items.map((page) =>
      page
        .map((item) => item.str)
        .join(" ")
        .replace(/[ \t]+/g, " ")
        .trim(),
    );
    const fromItems = pages.join("\n\n---PAGE---\n\n");
    if (fromItems.trim()) texts.push(fromItems);
    return texts;
  } finally {
    await pdf.loadingTask.destroy().catch(() => undefined);
  }
}
