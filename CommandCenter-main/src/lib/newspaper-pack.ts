/**
 * Sets one folio onto its fixed sheet. Runs on the live page before it is
 * painted (and again only when the sheet's height or its printed content
 * changes), so nothing is ever seen moving.
 *
 * A page "fits" when nothing runs past the sheet's foot and no flex/grid box
 * on it spills over what follows. Until it fits, working in the innermost box
 * that spills and lowest first:
 * 1. Blocks marked [data-tt-flow] and trailing children of the page's pack
 *    roots leave the page; story copy is cut on a line instead when at least
 *    MIN_CUT_LINES of it still fit (its "full story" line carries on). Before
 *    copy goes whole, the story's own [data-tt-yield] furniture goes.
 * 2. [data-tt-keep] blocks go the same way, last. [data-tt-lead] never does,
 *    nor does its headline.
 * 3. Anything else wholly below the foot goes, then the lowest whole unit
 *    (story, card, row, item, paragraph) still crossing it. A [data-tt-rows]
 *    board is never a unit: it loses its last tiles instead.
 * Each dropped block is then offered the room back, and stories that carry
 * the rest of their copy run on into whatever room is left.
 */

const FLOW = "[data-tt-flow]";
const PACK_ROOTS = ".wsj-front, .tt-section-front, .tt-scores, .wsj-sport-solo, .wx, .tt-stand-grid, [data-tt-pack]";
const KEEP = "[data-tt-keep]";
const LEAD = "[data-tt-lead]";
const COPY = ".wsj-prose, [data-tt-clip]";
const YIELD = "[data-tt-yield]";
/** Boards that lose their last tiles or rows rather than going whole. */
const ROWS = "[data-tt-rows]";
const UNIT =
  "article, li, tr, p, figure, section, aside, table, ul, ol, dl, dl > div, blockquote, h1, h2, h3, h4, h5, h6, header, footer, [data-tt-flow], [data-tt-keep]";
const LISTY = "ul, ol, table, tbody, dl";
const HEADLINE = ".wsj-hl, h1, h2, h3";
const PACKED = "ttPacked";
const CUT = "ttCut";
const GROWN = "ttGrown";
/** A cut that leaves fewer lines than this drops the block instead. */
export const MIN_CUT_LINES = 3;
/** A marked block this share of the page or more is cut inside, never dropped whole. */
const MAX_DROP_SHARE = 0.55;
/** The general fallback only drops units smaller than this share of the page. */
const MAX_UNIT_SHARE = 0.4;
/** Glyphs and rules may poke a few px past a box; that is not a spill. */
const SPILL_SLACK = 3;
const FILL_TRIES = 8;
/** Copy shortened to make room for a whole block keeps at least this share of itself. */
const SQUEEZE_KEEP = 0.5;
const REGION_MIN_H = 120;

export type PackResult = { dropped: number; cut: number; over: number };

/** Whole lines of `lineH` that fit in `room` px. */
export function linesThatFit(room: number, lineH: number): number {
  if (!(lineH > 0) || !(room > 0)) return 0;
  return Math.floor((room + 0.5) / lineH);
}

type Cand = { el: HTMLElement; top: number; copy: boolean; trim: number };
type Snapshot = {
  packed: HTMLElement[];
  cut: [HTMLElement, string][];
  settled: Map<HTMLElement, number>;
  natural: Map<HTMLElement, number>;
};

function isHidden(el: HTMLElement): boolean {
  return el.closest("[data-tt-packed]") != null;
}

function lineHeight(el: HTMLElement): number {
  const cs = getComputedStyle(el);
  const lh = Number.parseFloat(cs.lineHeight);
  if (Number.isFinite(lh) && lh > 0) return lh;
  return (Number.parseFloat(cs.fontSize) || 14) * 1.4;
}

function holdsLead(el: HTMLElement): boolean {
  return el.matches(LEAD) || el.querySelector(LEAD) != null;
}

function marked(sheet: HTMLElement): { flows: HTMLElement[]; keeps: HTMLElement[] } {
  const flows = new Set<HTMLElement>(sheet.querySelectorAll<HTMLElement>(FLOW));
  const keeps = new Set<HTMLElement>();
  for (const root of sheet.querySelectorAll<HTMLElement>(PACK_ROOTS)) {
    const kids = [...root.children].filter((n): n is HTMLElement => n instanceof HTMLElement);
    for (const kid of kids.slice(1)) {
      if (holdsLead(kid)) continue;
      (kid.matches(KEEP) ? keeps : flows).add(kid);
    }
  }
  for (const el of sheet.querySelectorAll<HTMLElement>(KEEP)) {
    if (!flows.has(el) && !holdsLead(el)) keeps.add(el);
  }
  return { flows: [...flows], keeps: [...keeps] };
}

/**
 * Layout regions of the page body whose overflow shows: the flex and grid
 * boxes that can spill over a neighbor. Chips and badges are not regions.
 */
function spillBoxes(sheet: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (const el of sheet.querySelectorAll<HTMLElement>(".wsj-body, .wsj-body *")) {
    if (el.clientHeight < REGION_MIN_H) continue;
    const cs = getComputedStyle(el);
    if (cs.overflowY !== "visible") continue;
    if (cs.display.includes("flex") || cs.display.includes("grid")) out.push(el);
  }
  return out;
}

export function packSheet(sheet: HTMLElement): PackResult {
  for (const el of sheet.querySelectorAll<HTMLElement>("[data-tt-packed]")) delete el.dataset[PACKED];
  for (const el of sheet.querySelectorAll<HTMLElement>("[data-tt-grown]")) delete el.dataset[GROWN];
  for (const el of sheet.querySelectorAll<HTMLElement>("[data-tt-cut]")) {
    delete el.dataset[CUT];
    el.style.removeProperty("height");
  }

  const scale = sheet.getBoundingClientRect().height / (sheet.offsetHeight || 1) || 1;
  const pageH = sheet.clientHeight;
  const { flows, keeps } = marked(sheet);
  const copies = [...sheet.querySelectorAll<HTMLElement>(COPY)];
  const boxes = spillBoxes(sheet);
  /** Boxes nothing on the page can fix, at the spill they started with. */
  const settled = new Map<HTMLElement, number>();
  /** The dropped block being offered its room back; nothing may drop it again. */
  let held: HTMLElement | null = null;
  const kept = (el: HTMLElement) =>
    holdsLead(el) || (el.matches(HEADLINE) && el.closest(LEAD) != null) || (held != null && el.contains(held));
  /** Full heights of copy shortened to make room for a held block. */
  const natural = new Map<HTMLElement, number>();

  const rawSpill = (box: HTMLElement): number => {
    if (box === sheet) return sheet.scrollHeight - pageH;
    if (isHidden(box) || box.clientHeight < 1) return 0;
    return box.scrollHeight - box.clientHeight;
  };
  const spill = (box: HTMLElement): number => {
    const s = rawSpill(box) - (settled.get(box) ?? 0);
    return box === sheet ? (s > 1 ? s : 0) : s > SPILL_SLACK ? s : 0;
  };
  /** The innermost box that spills: no spilling box sits inside it. */
  const worst = (): HTMLElement | null => {
    for (let i = boxes.length - 1; i >= 0; i--) if (spill(boxes[i]!) > 0) return boxes[i]!;
    return spill(sheet) > 0 ? sheet : null;
  };
  const over = (): number => {
    let most = spill(sheet);
    for (const box of boxes) most = Math.max(most, spill(box));
    return most;
  };
  const footOf = (box: HTMLElement) => {
    const r = box.getBoundingClientRect();
    const padB = Number.parseFloat(getComputedStyle(box).paddingBottom) || 0;
    const h = box === sheet ? pageH : box.clientHeight;
    return r.top + (box.clientTop + h - padB) * scale;
  };

  const drop = (el: HTMLElement) => {
    el.dataset[PACKED] = "";
  };

  /** Lines of this copy that fit above the foot, leaving room for what its story sets after it. */
  const copyFit = (el: HTMLElement, limit: number) => {
    const r = el.getBoundingClientRect();
    if (r.height < 1) return null;
    const host = el.parentElement?.closest<HTMLElement>("article, [data-tt-flow], [data-tt-keep]");
    const hostBottom = host ? Math.max(r.bottom, host.getBoundingClientRect().bottom) : r.bottom;
    const lh = lineHeight(el);
    const lines = linesThatFit((limit - r.top - (hostBottom - r.bottom)) / scale, lh);
    return { top: r.top, bottom: hostBottom, lines, lh };
  };

  const cutTo = (el: HTMLElement, limit: number): boolean => {
    const fit = copyFit(el, limit);
    if (!fit || fit.lines < MIN_CUT_LINES) return false;
    el.style.height = `${fit.lines * fit.lh}px`;
    el.dataset[CUT] = "";
    return true;
  };

  const blocks = (list: HTMLElement[], box: HTMLElement, limit: number, out: Cand[]) => {
    for (const el of list) {
      if (!box.contains(el) || isHidden(el) || kept(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.height < 1 || r.bottom <= limit + 1) continue;
      if (r.height / scale >= pageH * MAX_DROP_SHARE) continue;
      out.push({ el, top: r.top, copy: false, trim: Number(el.dataset.ttTrim ?? 0) });
    }
  };

  const firstTier = (box: HTMLElement, limit: number): Cand | undefined => {
    const out: Cand[] = [];
    blocks(flows, box, limit, out);
    for (const el of copies) {
      if (!box.contains(el) || isHidden(el) || el.dataset[CUT] != null) continue;
      const fit = copyFit(el, limit);
      if (!fit || fit.bottom <= limit + 1) continue;
      if (fit.lines < MIN_CUT_LINES && !furnitureAbove(el)) continue;
      out.push({ el, top: fit.top, copy: true, trim: 0 });
    }
    // Furniture that itself crosses the foot goes before its story, even a story with no copy.
    for (const el of sheet.querySelectorAll<HTMLElement>(YIELD)) {
      if (!box.contains(el) || isHidden(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.height < 1 || r.top >= limit - 1 || r.bottom <= limit + 1) continue;
      out.push({ el, top: r.top, copy: false, trim: 0 });
    }
    return out.sort((a, b) => b.top - a.top || b.trim - a.trim)[0];
  };

  /** The lowest [data-tt-yield] block set above this copy in its story, which goes before the copy does. */
  const furnitureAbove = (copy: HTMLElement): HTMLElement | null => {
    const story = copy.closest("article");
    if (!story) return null;
    const top = copy.getBoundingClientRect().top;
    let best: HTMLElement | null = null;
    let bestBottom = -Infinity;
    for (const el of story.querySelectorAll<HTMLElement>(YIELD)) {
      if (isHidden(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.height < 1 || r.bottom > top + 1) continue;
      if (r.bottom > bestBottom) {
        best = el;
        bestBottom = r.bottom;
      }
    }
    return best;
  };

  const keepTier = (box: HTMLElement, limit: number): Cand | undefined => {
    const out: Cand[] = [];
    blocks(keeps, box, limit, out);
    return out.sort((a, b) => b.top - a.top)[0];
  };

  /**
   * Hides whatever in `box` sits wholly below its foot; returns the lowest
   * whole unit still crossing it (a story or card goes whole; a list or table
   * by rows).
   */
  const sweep = (box: HTMLElement, limit: number): HTMLElement | null => {
    let crossing: HTMLElement | null = null;
    let crossingTop = -Infinity;
    const walk = (el: HTMLElement) => {
      for (const kid of el.children) {
        if (!(kid instanceof HTMLElement) || kid.dataset[PACKED] != null || kid.dataset[CUT] != null) continue;
        const r = kid.getBoundingClientRect();
        if (r.height < 1) continue;
        if (r.top >= limit - 1) {
          if (!kept(kid)) drop(kid);
          continue;
        }
        // A box sized to the page can end at the foot while its children spill past it.
        const spills =
          r.bottom <= limit + 1 &&
          kid.scrollHeight > kid.clientHeight + SPILL_SLACK &&
          getComputedStyle(kid).overflowY === "visible";
        if (r.bottom <= limit + 1 && !spills) continue;
        // Paragraphs set in columns are not in reading order top to bottom; the copy goes as one.
        const cs = getComputedStyle(kid);
        const setInColumns = kid.matches(COPY) && (cs.columnWidth !== "auto" || cs.columnCount !== "auto");
        const whole =
          setInColumns ||
          (kid.matches(UNIT) &&
            !kid.matches(ROWS) &&
            !kept(kid) &&
            r.height / scale < pageH * MAX_UNIT_SHARE &&
            !(kid.matches(LISTY) && kid.children.length > 2));
        if (whole) {
          if (r.top > crossingTop) {
            crossing = kid;
            crossingTop = r.top;
          }
          continue;
        }
        walk(kid);
      }
    };
    walk(box);
    return crossing;
  };

  const shows = (n: Element) => n instanceof HTMLElement && !isHidden(n) && n.getClientRects().length > 0;

  /**
   * Drops what packing left meaningless, until nothing more goes: a story
   * without its headline or without any of its copy, a table or list with no
   * rows left, and a box holding only labels (or nothing at all).
   */
  const dropOrphans = () => {
    for (let changed = true; changed; ) {
      changed = false;
      const gone = (el: HTMLElement) => {
        drop(el);
        changed = true;
      };
      for (const story of sheet.querySelectorAll<HTMLElement>("article")) {
        if (isHidden(story) || holdsLead(story)) continue;
        const hl = story.querySelector<HTMLElement>(HEADLINE);
        if (hl && isHidden(hl)) {
          gone(story);
          continue;
        }
        const prose = [...story.querySelectorAll<HTMLElement>(COPY)];
        if (prose.length && !prose.some((p) => shows(p) && p.getBoundingClientRect().height >= 1)) gone(story);
      }
      for (const rows of sheet.querySelectorAll<HTMLElement>("table, tbody")) {
        if (isHidden(rows) || !rows.querySelector("td")) continue;
        if (![...rows.querySelectorAll("tr")].some((tr) => shows(tr) && tr.querySelector("td"))) gone(rows);
      }
      for (const list of sheet.querySelectorAll<HTMLElement>("ul, ol, dl")) {
        if (isHidden(list) || !list.children.length) continue;
        if (![...list.querySelectorAll("li, dd")].some(shows)) gone(list);
      }
      for (const box of sheet.querySelectorAll<HTMLElement>(
        "section, aside, [data-tt-flow], [data-tt-keep], .tt-agate-group, .tt-agate-wrap, .wsj-inside-story, .wsj-clubs-desk",
      )) {
        if (isHidden(box) || holdsLead(box) || !box.children.length) continue;
        const kids = [...box.children].filter(shows);
        if (kids.every((k) => k.matches("h1, h2, h3, h4, h5, h6, header, .wsj-kicker, .wsj-continued-from"))) gone(box);
      }
    }
  };

  /**
   * Shortens the copy set above a held story (in its column) by what the
   * story runs past the foot, keeping at least SQUEEZE_KEEP of that copy.
   * Only a whole story is worth copy; a box or a list is not.
   */
  const squeeze = (box: HTMLElement, limit: number): boolean => {
    if (!held || !box.contains(held) || isHidden(held)) return false;
    if (!held.matches("article") && !held.querySelector("article")) return false;
    const hr = held.getBoundingClientRect();
    if (hr.bottom <= limit + 1) return false;
    let above: HTMLElement | null = null;
    let aboveBottom = -Infinity;
    for (const el of copies) {
      if (!box.contains(el) || held.contains(el) || isHidden(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.height < 1 || r.bottom > hr.top + 1 || r.left >= hr.right || r.right <= hr.left) continue;
      if (el.dataset[CUT] != null && !natural.has(el)) continue;
      if (r.bottom > aboveBottom) {
        above = el;
        aboveBottom = r.bottom;
      }
    }
    if (!above) return false;
    const h = above.getBoundingClientRect().height / scale;
    const full = natural.get(above) ?? h;
    const lh = lineHeight(above);
    const lines = linesThatFit(h - (hr.bottom - limit) / scale, lh);
    if (lines < MIN_CUT_LINES || lines * lh < full * SQUEEZE_KEEP) return false;
    natural.set(above, full);
    above.style.height = `${lines * lh}px`;
    above.dataset[CUT] = "";
    return true;
  };

  const settle = () => {
    for (let guard = 0; guard < 100; guard++) {
      const box = worst();
      if (!box) break;
      const limit = footOf(box);
      const next = firstTier(box, limit) ?? keepTier(box, limit);
      if (next) {
        if (next.copy && cutTo(next.el, limit)) continue;
        drop((next.copy && furnitureAbove(next.el)) || next.el);
        continue;
      }
      if (squeeze(box, limit)) continue;
      const unit = sweep(box, limit);
      if (spill(box) <= 0) continue;
      if (unit) drop(unit);
      else settled.set(box, rawSpill(box));
    }
    dropOrphans();
  };

  const snapshot = (): Snapshot => ({
    packed: [...sheet.querySelectorAll<HTMLElement>("[data-tt-packed]")],
    cut: [...sheet.querySelectorAll<HTMLElement>("[data-tt-cut]")].map((el) => [el, el.style.height]),
    settled: new Map(settled),
    natural: new Map(natural),
  });
  const restore = (snap: Snapshot) => {
    settled.clear();
    for (const [box, s] of snap.settled) settled.set(box, s);
    natural.clear();
    for (const [el, h] of snap.natural) natural.set(el, h);
    for (const el of sheet.querySelectorAll<HTMLElement>("[data-tt-packed]")) delete el.dataset[PACKED];
    for (const el of sheet.querySelectorAll<HTMLElement>("[data-tt-cut]")) {
      delete el.dataset[CUT];
      el.style.removeProperty("height");
    }
    for (const el of snap.packed) el.dataset[PACKED] = "";
    for (const [el, h] of snap.cut) {
      el.dataset[CUT] = "";
      el.style.height = h;
    }
  };
  /** Prints something worth the room: real type or a picture, not a lone label. */
  const substantive = (el: HTMLElement) => {
    if (isHidden(el)) return false;
    if (el.getBoundingClientRect().height / scale < 36) return false;
    if ([...el.querySelectorAll(HEADLINE)].some(shows)) return true;
    if ([...el.querySelectorAll("img")].some(shows)) return true;
    return (el.innerText ?? "").trim().length >= 60;
  };

  // Marked blocks wholly below the foot go in one pass; nothing above them moves.
  if (spill(sheet) > 0) {
    const limit = footOf(sheet);
    for (const el of flows) {
      if (isHidden(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.height >= 1 && r.top >= limit - 1) drop(el);
    }
  }
  settle();

  // Dropped stories are offered their room back before boxes and lists, and no refill may cost a story.
  const stories = () => [...sheet.querySelectorAll<HTMLElement>("article")].filter((a) => !isHidden(a)).length;
  const tried = new Set<HTMLElement>();
  for (let tries = 0; tries < FILL_TRIES && over() <= 0; tries++) {
    const out = [...sheet.querySelectorAll<HTMLElement>("[data-tt-packed]")].filter(
      (el) => !tried.has(el) && !el.parentElement?.closest("[data-tt-packed]"),
    );
    const next = out.find((el) => el.matches("article") || el.querySelector("article")) ?? out[0];
    if (!next) break;
    tried.add(next);
    const before = snapshot();
    const told = stories();
    delete next.dataset[PACKED];
    held = next;
    settle();
    held = null;
    if (over() > 0 || settled.size > before.settled.size || stories() < told || !substantive(next)) {
      restore(before);
      // WebKit can lay the restored page out taller than it measured before the try.
      if (over() > 0) settle();
    }
  }
  dropOrphans();
  if (over() > 0) settle();

  // A story carrying the rest of its copy runs on, a line at a time, into room nothing else wants.
  for (const el of copies) {
    if (over() > 0) break;
    if (isHidden(el) || el.dataset[CUT] != null || !el.querySelector("[data-tt-more]")) continue;
    const lh = lineHeight(el);
    const h0 = Math.round(el.getBoundingClientRect().height / scale / lh) * lh;
    el.dataset[GROWN] = "";
    const room = Math.floor((el.getBoundingClientRect().height / scale - h0) / lh);
    el.dataset[CUT] = "";
    const fits = (n: number) => {
      el.style.height = `${h0 + n * lh}px`;
      return over() <= 0;
    };
    let lo = 0;
    let hi = Math.max(0, room);
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (fits(mid)) lo = mid;
      else hi = mid - 1;
    }
    if (lo < 1) {
      delete el.dataset[GROWN];
      delete el.dataset[CUT];
      el.style.removeProperty("height");
    } else fits(lo);
  }

  const left = Math.max(0, sheet.scrollHeight - pageH);
  if (left > 1) sheet.dataset.ttOverfull = String(Math.round(left));
  else delete sheet.dataset.ttOverfull;
  return {
    dropped: sheet.querySelectorAll("[data-tt-packed]").length,
    cut: sheet.querySelectorAll("[data-tt-cut]").length,
    over: left,
  };
}
