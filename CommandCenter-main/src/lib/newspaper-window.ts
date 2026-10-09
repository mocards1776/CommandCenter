/**
 * Which newspaper sheets are built, and the folio numbers printed on them.
 *
 * The window is the current page ± PAGE_WINDOW. Inside Today, section
 * page numbers, and jump folios are read from the full edition — never from
 * the sheets that happen to be mounted.
 */

export const PAGE_WINDOW = 2;

/** Indexes that mount for `current`. Clamped to the book. */
export function mountedPageIndexes(current: number, pageCount: number, radius = PAGE_WINDOW): number[] {
  if (!(pageCount > 0)) return [];
  const last = pageCount - 1;
  const cur = Number.isFinite(current) ? Math.max(0, Math.min(last, Math.trunc(current))) : 0;
  const start = Math.max(0, cur - radius);
  const end = Math.min(last, cur + radius);
  const out: number[] = [];
  for (let i = start; i <= end; i++) out.push(i);
  return out;
}

/**
 * A1 mounts alone until the first paint has settled (`neighborsOn`).
 * Once the reader leaves A1, the window mounts immediately so a turn is not blank.
 */
export function pageShouldMount(
  index: number,
  current: number,
  neighborsOn: boolean,
  radius = PAGE_WINDOW,
): boolean {
  if (index < 0) return false;
  if (!neighborsOn && current <= 0) return index === 0;
  return Math.abs(index - current) <= radius;
}

export type ReaderFolioPage = {
  folio: string;
  section: string;
  sectionPage: number;
  sectionCount: number;
  jumpFolio?: string;
  leadContinue?: string;
  secondContinue?: string;
  thirdContinue?: string;
  turn?: { folio: string } | null;
  articles?: { folio: string }[];
  sectionDesks?: { folio: string }[];
};

export type ReaderFolioSection = {
  code: string;
  title: string;
  folio: string;
  index: number;
  stories: number;
  pages: number;
};

export type ReaderFolioSource = {
  pages: readonly ReaderFolioPage[];
  sections: readonly ReaderFolioSection[];
  favoriteFolioByStory?: Record<string, string>;
  sportFolioByStory?: Record<string, string>;
};

export type InsideTodayRow = {
  code: string;
  title: string;
  folio: string;
  stories: number;
  pages: number;
  index: number;
};

export type SectionPageNumber = {
  folio: string;
  section: string;
  sectionPage: number;
  sectionCount: number;
};

export type ReaderFolioIndex = {
  insideToday: InsideTodayRow[];
  sectionPages: SectionPageNumber[];
  /** Stable jump targets: story keys and continuation folios from the full book. */
  jumps: string[];
};

function pushJump(out: string[], value: string | null | undefined) {
  if (value) out.push(value);
}

/**
 * Page counts and jump targets the reader prints.
 * `mountedIndexes` is the on-screen window. It is not a filter — a 5-page
 * window and the full book return the same index.
 */
export function readerFolioIndex(edition: ReaderFolioSource, mountedIndexes?: readonly number[]): ReaderFolioIndex {
  // `mountedIndexes` is the on-screen window. It is not a filter: counting
  // only those sheets would renumber folios and shrink Inside Today.
  void mountedIndexes;
  const jumps: string[] = [];
  for (const [id, folio] of Object.entries(edition.favoriteFolioByStory ?? {})) jumps.push(`${id}@${folio}`);
  for (const [id, folio] of Object.entries(edition.sportFolioByStory ?? {})) jumps.push(`${id}@${folio}`);
  for (const page of edition.pages) {
    pushJump(jumps, page.jumpFolio);
    pushJump(jumps, page.leadContinue);
    pushJump(jumps, page.secondContinue);
    pushJump(jumps, page.thirdContinue);
    pushJump(jumps, page.turn?.folio);
    for (const desk of page.sectionDesks ?? []) pushJump(jumps, desk.folio);
    for (const article of page.articles ?? []) pushJump(jumps, article.folio);
  }
  jumps.sort();
  return {
    insideToday: edition.sections
      .filter((section) => section.code !== "A")
      .map((section) => ({
        code: section.code,
        title: section.title,
        folio: section.folio,
        stories: section.stories,
        pages: section.pages,
        index: section.index,
      })),
    sectionPages: edition.pages.map((page) => ({
      folio: page.folio,
      section: page.section,
      sectionPage: page.sectionPage,
      sectionCount: page.sectionCount,
    })),
    jumps,
  };
}
