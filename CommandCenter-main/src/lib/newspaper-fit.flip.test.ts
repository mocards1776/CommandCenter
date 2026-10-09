/**
 * Run with: node --experimental-strip-types src/lib/newspaper-fit.flip.test.ts
 * from CommandCenter-main/.
 *
 * Minimal A1 derived from the 2026-10-08-morning newspaper_issues row.
 * On main, a WebKit cold open at 1032×1376 flipped that sheet between
 * ~1430px and ~2960px. happy-dom does not lay out, so block heights are
 * shimmed; the hide stylesheet is the real one FittedSheet installs.
 */
import { Window } from "happy-dom";
import { getA1Held, publishA1Held } from "./newspaper-a1-held.ts";
import {
  HARD_PAGE_H,
  clearSheetDropLocks,
  hideCssForPlan,
  planSheetFit,
  plansEqual,
  sheetDropKey,
  type SheetFitPlan,
} from "./newspaper-fit.ts";

const win = new Window({ url: "http://localhost/", innerWidth: 1032, innerHeight: 1376 });
function installGlobal(name: string, value: unknown): void {
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
}
installGlobal("window", win);
installGlobal("document", win.document);
installGlobal("HTMLElement", win.HTMLElement);
installGlobal("Element", win.Element);
installGlobal("Node", win.Node);
installGlobal("getComputedStyle", win.getComputedStyle.bind(win));

type PaperEl = {
  hidden: boolean;
  parentElement: PaperEl | null;
  children: Iterable<PaperEl>;
  getAttribute(name: string): string | null;
  querySelector(selectors: string): PaperEl | null;
  querySelectorAll(selectors: string): Iterable<PaperEl>;
  scrollHeight: number;
};

function live(el: PaperEl): HTMLElement {
  return el as unknown as HTMLElement;
}

function shown(el: PaperEl): boolean {
  let node: PaperEl | null = el;
  while (node) {
    if (node.hidden) return false;
    if (win.getComputedStyle(node as never).display === "none") return false;
    node = node.parentElement;
  }
  return true;
}

function contentHeight(el: PaperEl): number {
  if (!shown(el)) return 0;
  const own = Number(el.getAttribute("data-h") || "0");
  let sum = Number.isFinite(own) ? own : 0;
  for (const child of el.children) sum += contentHeight(child!);
  return sum;
}

Object.defineProperty(win.Element.prototype, "scrollHeight", {
  configurable: true,
  get() {
    return contentHeight(this as unknown as PaperEl);
  },
});
Object.defineProperty(win.Element.prototype, "offsetHeight", {
  configurable: true,
  get() {
    return contentHeight(this as unknown as PaperEl);
  },
});
Object.defineProperty(win.HTMLElement.prototype, "clientWidth", {
  configurable: true,
  get() {
    return 1032;
  },
});
Object.defineProperty(win.HTMLElement.prototype, "offsetWidth", {
  configurable: true,
  get() {
    return 1032;
  },
});
(win.Element.prototype as unknown as { getBoundingClientRect: () => unknown }).getBoundingClientRect = function rect(this: { getAttribute(name: string): string | null }) {
  const bottom = Number(this.getAttribute("data-bottom") || "0");
  const height = Number(this.getAttribute("data-h") || "0");
  return {
    x: 0,
    y: Math.max(0, bottom - height),
    width: 0,
    height,
    top: Math.max(0, bottom - height),
    right: 0,
    bottom,
    left: 0,
    toJSON() {
      return {};
    },
  };
};

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

const PAGES = "wire-mlb-401908016";
const ADELL = "wire-mlb-401907992";
const BUCS = "news-50107167";
const LEAD = "wire-lead-2026-10-08";

function mount(html: string): PaperEl {
  win.document.body.innerHTML = "";
  const root = win.document.createElement("div");
  root.className = "newspaper-root";
  root.setAttribute("data-edition", "2026-10-08-morning");
  root.innerHTML = `<div class="wsj-pager">${html}</div>`;
  win.document.body.appendChild(root);
  const sheet = root.querySelector(".wsj-sheet");
  if (!sheet) throw new Error("sheet missing");
  return sheet as unknown as PaperEl;
}

function applyPlan(sheet: PaperEl, plan: SheetFitPlan): void {
  let style = win.document.getElementById("tt-fit-style");
  if (!style) {
    style = win.document.createElement("style");
    style.id = "tt-fit-style";
    win.document.head.appendChild(style);
  }
  const id = sheet.getAttribute("data-tt-sheet") || "";
  style.textContent = hideCssForPlan(id, plan);
}

const a1 = mount(`
  <article class="wsj-sheet" data-tt-sheet="a1" data-folio="A1">
    <div class="wsj-front">
      <article data-tt-lead data-tt-story="${LEAD}" data-h="800" data-bottom="800">Lead stays on A1</article>
      <div data-tt-keep data-h="500" data-bottom="1300">Under the lead</div>
      <div data-tt-flow data-tt-story="${PAGES}" data-tt-relocate="1" data-h="600" data-bottom="1900">Pages delivers go-ahead single in 7th as Dodgers beat Braves 4-1</div>
      <div data-tt-flow data-bottom="2700">
        <article data-tt-story="${ADELL}" data-h="400" data-bottom="2300">Jo Adell and José Ramírez star as the Guardians beat the White Sox 9-3</article>
        <article data-tt-story="${BUCS}" data-h="400" data-bottom="2700">How to bet Bucs-Cowboys on TNF: Analysis, tips and top prop plays</article>
      </div>
    </div>
  </article>
`);

clearSheetDropLocks();
const full = a1.scrollHeight;
assert(full > HARD_PAGE_H, `morning fixture starts over the page (${full})`);

const first = planSheetFit(live(a1));
applyPlan(a1, first);
const packed = a1.scrollHeight;
const second = planSheetFit(live(a1));
applyPlan(a1, second);
const third = planSheetFit(live(a1));
applyPlan(a1, third);
const settled = a1.scrollHeight;

assert(plansEqual(first, second) && plansEqual(second, third), "fit plan converges; a later measure must not restore dropped blocks");
assert(packed <= HARD_PAGE_H && settled === packed, `visible sheet stays packed (${packed} then ${settled}), not back at ${full}`);
assert(settled !== full, "the packed sheet is shorter than the unfitted morning sheet");

const lead = a1.querySelector("[data-tt-lead]");
assert(lead && shown(lead), "the lead stays on the sheet");
assert(!(first.moved ?? []).includes(LEAD), "the lead is never moved inside");

const moved = first.moved ?? [];
assert(moved.length === 3, `dropping 3 stories records all 3 (got ${moved.length}: ${moved.join(", ")})`);
assert(
  moved[0] === PAGES && moved[1] === ADELL && moved[2] === BUCS,
  `moved stories stay in A1 rank order, top first (got ${moved.join(", ")})`,
);
assert(
  a1.querySelector(`[data-tt-story="${ADELL}"]`)?.getAttribute("data-tt-relocate") == null &&
    a1.querySelector(`[data-tt-story="${BUCS}"]`)?.getAttribute("data-tt-relocate") == null,
  "the vanished briefs are stories without data-tt-relocate",
);

publishA1Held(sheetDropKey(live(a1)), moved);
const onA2 = getA1Held();
assert(
  onA2.length === 3 && onA2[0] === PAGES && onA2[1] === ADELL && onA2[2] === BUCS,
  `A2 prints all ${moved.length} dropped stories in rank order`,
);

clearSheetDropLocks();
const a2 = mount(`
  <article class="wsj-sheet" data-tt-sheet="a2" data-folio="A2">
    <div class="wsj-a1-held" data-tt-keep data-h="900" data-bottom="900">Stories held from A1</div>
    <section class="wx">
      <header class="wx-head" data-h="40" data-bottom="940">The Weather</header>
      <div class="wx-top" data-h="500" data-bottom="1440"><div class="wx-now">Right now</div></div>
      <ol class="wx-outlook" data-h="400" data-bottom="1840">7-day outlook</ol>
      <aside class="wx-almanac" data-h="350" data-bottom="2190">Almanac</aside>
      <p class="wx-credit" data-h="20" data-bottom="2210">Forecast data</p>
    </section>
    <div data-tt-flow data-h="800" data-bottom="3010">Later club block</div>
  </article>
`);
assert(a2.scrollHeight > HARD_PAGE_H, "held stories push A2 over the page");
const weatherPlan = planSheetFit(live(a2));
applyPlan(a2, weatherPlan);
for (const sel of [".wx-now", ".wx-outlook", ".wx-almanac", ".wx-head"]) {
  const el = a2.querySelector(sel);
  assert(el && shown(el), `A2 weather stays visible (${sel})`);
}
assert(
  weatherPlan.hide.length === 1,
  `only the non-weather overflow is hidden (got ${weatherPlan.hide.length})`,
);
assert(shown(a2.querySelector(".wx")!), "the weather section itself is not hidden");

clearSheetDropLocks();
const scores = mount(`
  <article class="wsj-sheet" data-tt-sheet="scores" data-folio="B1">
    <div class="tt-scores">
      <div data-h="1000" data-bottom="1000">First table</div>
      <div data-h="1000" data-bottom="2000">Second table</div>
    </div>
  </article>
`);
const scoresPlan = planSheetFit(live(scores));
applyPlan(scores, scoresPlan);
const tables = [...scores.querySelectorAll(".tt-scores > div")];
assert(shown(tables[0]!), "a non-weather pack root still keeps its first block");
assert(!shown(tables[1]!), "a non-weather pack root still hides its last block");

console.log("newspaper-fit flip ok");
