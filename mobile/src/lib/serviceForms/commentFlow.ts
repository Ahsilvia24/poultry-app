export const PLACEMENT_COMMENT_FIELDS = [
  "Comments first line",
  "Comments 1",
  "Comments 2",
  "Comments 3",
  "Comments 4",
  "Comments 5",
  "Comments 6",
  "Comments 7",
  "Comments 8",
  "Comments 9",
] as const;

export const SERVICE_REPORT_COMMENT_FIELDS = [
  "COMMENTS 1",
  "COMMENTS 2",
  "COMMENTS 3",
  "Comments 4",
  "Comments 5",
  "Comments 6",
  "Comments 7",
  "Comments 8",
  "Comments 9",
] as const;

export const PREBROOD_COMMENT_FIELDS = [
  "Comments first line",
  "Comments 1_2",
  "Comments 2_2",
  "Comments 3_2",
  "Comments 4_2",
  "Comments 5_2",
  "Comments 6_2",
  "Comments 7_2",
  "Comments 8_2",
  "comments 9",
  "comments 10",
  "comments 11",
  "comments 12",
  "comments 13",
] as const;

export const MAX_PLACEMENT_COMMENT_PAGES = 12;

export function splitCommentWords(text: string) {
  return String(text ?? "")
    .split(/\s+/)
    .filter(Boolean);
}

export function takeCommentLine(
  words: string[],
  measure: (text: string) => number,
  maxWidth: number,
): { line: string; rest: string[] } {
  let cur = "";
  let i = 0;
  for (; i < words.length; i++) {
    const word = words[i]!;
    const next = cur ? `${cur} ${word}` : word;
    if (cur && measure(next) > maxWidth) break;
    cur = next;
  }
  return { line: cur, rest: words.slice(i) };
}

/** Fit words onto a fixed set of line widths. Leftover text goes on the next sheet. */
export function consumeCommentLines(
  text: string,
  lineWidths: number[],
  measure: (text: string) => number,
): { lines: string[]; rest: string } {
  let words = splitCommentWords(text);
  const lines: string[] = [];
  for (const maxWidth of lineWidths) {
    if (words.length === 0) break;
    const { line, rest } = takeCommentLine(words, measure, maxWidth);
    if (!line) {
      lines.push(words[0]!);
      words = words.slice(1);
      continue;
    }
    lines.push(line);
    words = rest;
  }
  return { lines, rest: words.join(" ") };
}

export function commentPageCount(
  text: string,
  lineWidths: number[],
  measure: (text: string) => number,
  maxPages = MAX_PLACEMENT_COMMENT_PAGES,
) {
  let comments = String(text ?? "").trim();
  if (!comments) return 1;
  let pages = 0;
  while (pages < maxPages) {
    pages += 1;
    const { rest } = consumeCommentLines(comments, lineWidths, measure);
    if (!rest || rest === comments) break;
    comments = rest;
  }
  return pages;
}
