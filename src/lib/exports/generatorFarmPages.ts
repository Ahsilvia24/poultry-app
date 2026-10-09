import { splitColumnGroups } from "./splitColumnGroups";

export type GeneratorFarmSlice<T> = {
  /** Start a new page before drawing this slice. */
  newPageBefore: boolean;
  /** Draw the farm name before these columns. */
  showHeading: boolean;
  groups: T[];
};

/**
 * Place one farm's generator columns so a page does not open mid-log.
 * A farm that fits on an empty page stays on one page. A taller farm
 * continues, and each new page starts with the farm name.
 */
export function layoutGeneratorFarmColumns<T extends { rows: ReadonlyArray<unknown> }>(opts: {
  groups: T[];
  columnsPerRow: number;
  measure: (group: T) => number;
  headingHeight: number;
  bandGap: number;
  remaining: number;
  pageHeight: number;
  minBandBudget?: number;
}): GeneratorFarmSlice<T>[] {
  const perRow = Math.max(1, opts.columnsPerRow);
  const minBudget = opts.minBandBudget ?? 48;
  const headingHeight = Math.max(0, opts.headingHeight);
  const bands: T[][] = [];
  for (let i = 0; i < opts.groups.length; i += perRow) {
    bands.push(opts.groups.slice(i, i + perRow));
  }

  if (bands.length === 0) {
    if (headingHeight <= 0) return [];
    return [
      {
        newPageBefore: headingHeight > opts.remaining,
        showHeading: true,
        groups: [],
      },
    ];
  }

  const tableHeight = (band: T[]) => {
    if (band.length === 0) return 0;
    return Math.max(12, ...band.map((group) => opts.measure(group)));
  };
  const bandHeight = (band: T[]) => tableHeight(band) + opts.bandGap;
  const rowCount = (groups: T[]) =>
    groups.reduce((sum, group) => sum + group.rows.length, 0);

  const fullHeight = headingHeight + bands.reduce((sum, band) => sum + bandHeight(band), 0);

  let space = opts.remaining;
  let newPageBeforeNext = false;
  let headingOnThisPage = false;
  if (fullHeight > opts.remaining && fullHeight <= opts.pageHeight) {
    space = opts.pageHeight;
    newPageBeforeNext = true;
  }

  const slices: GeneratorFarmSlice<T>[] = [];

  const blankPage = () => {
    space = opts.pageHeight;
    newPageBeforeNext = true;
    headingOnThisPage = false;
  };

  for (const band of bands) {
    let current = band;
    let guard = 0;
    while (current.length > 0 && guard < 200) {
      guard += 1;
      const headingCost = headingOnThisPage ? 0 : headingHeight;
      const needed = headingCost + bandHeight(current);
      if (needed <= space) {
        slices.push({
          newPageBefore: newPageBeforeNext,
          showHeading: headingCost > 0,
          groups: current,
        });
        space -= needed;
        newPageBeforeNext = false;
        headingOnThisPage = true;
        break;
      }

      const freshNeeded = headingHeight + bandHeight(current);
      const alreadyBlank = newPageBeforeNext && !headingOnThisPage;
      if (freshNeeded <= opts.pageHeight && !alreadyBlank) {
        blankPage();
        continue;
      }

      const tableBudget = space - headingCost - opts.bandGap;
      if (tableBudget < minBudget && !alreadyBlank) {
        blankPage();
        continue;
      }

      const { head, tail } = splitColumnGroups(current, Math.max(tableBudget, 1), opts.measure);
      if (rowCount(head) === 0) {
        if (!alreadyBlank) {
          blankPage();
          continue;
        }
        break;
      }

      slices.push({
        newPageBefore: newPageBeforeNext,
        showHeading: headingCost > 0,
        groups: head,
      });
      space -= headingCost + bandHeight(head);
      newPageBeforeNext = false;
      headingOnThisPage = true;
      if (tail.length === 0 || rowCount(head) >= rowCount(current)) break;
      current = tail;
      blankPage();
    }
  }

  return slices;
}

/** A farm heading belongs with the generator columns that follow it. */
export function withGeneratorFarmHeadings<T extends { type: string }>(blocks: readonly T[]): T[] {
  const out: T[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!;
    const next = blocks[i + 1] as (T & { heading?: string }) | undefined;
    if (block.type === "heading" && next?.type === "columnGroups") {
      const text = (block as T & { text?: string }).text ?? "";
      out.push({ ...next, heading: next.heading || text } as T);
      i += 1;
      continue;
    }
    out.push(block);
  }
  return out;
}
