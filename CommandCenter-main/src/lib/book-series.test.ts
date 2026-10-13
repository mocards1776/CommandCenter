/**
 * Run with: node --experimental-strip-types src/lib/book-series.test.ts
 * from CommandCenter-main/.
 */
import {
  buildSeriesStrip,
  librarySeriesNames,
  normalizeSeriesName,
  parseSeriesPositionInput,
  seriesPositionLabel,
  seriesPositionNumber,
  seriesSummary,
  type SeriesBook,
} from "./book-series.ts";

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

function assertEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`);
  }
}

let n = 0;
function book(over: Partial<SeriesBook> & { title: string }): SeriesBook {
  n++;
  return {
    id: over.id ?? `b${n}`,
    series: "Mickey Haller",
    series_position: null,
    status: "to-read",
    read_count: 0,
    content_type: "book",
    cover_path: null,
    cover_url: null,
    published_year: null,
    ...over,
  };
}

// ── position helpers ────────────────────────────────────────────────────
assertEqual(seriesPositionNumber("1.0"), 1, "PostgREST numeric string parses");
assertEqual(seriesPositionNumber(12.5), 12.5, "number passes through");
assertEqual(seriesPositionNumber(null), null, "null stays null");
assertEqual(seriesPositionNumber("abc"), null, "garbage is unnumbered");
assertEqual(seriesPositionLabel("1.0"), "#1", "integer label drops .0");
assertEqual(seriesPositionLabel(12.5), "#12.5", "fraction label keeps .5");
assertEqual(seriesPositionLabel(null), "", "no label when unnumbered");

assertEqual(parseSeriesPositionInput(""), null, "blank clears position");
assertEqual(parseSeriesPositionInput(" #4 "), 4, "accepts #4");
assertEqual(parseSeriesPositionInput("12.5"), 12.5, "accepts novella numbering");
assertEqual(parseSeriesPositionInput("-1"), undefined, "rejects negative");
assertEqual(parseSeriesPositionInput("book two"), undefined, "rejects text");

assertEqual(normalizeSeriesName("  Joe   Pickett "), "Joe Pickett", "collapses whitespace");
assertEqual(normalizeSeriesName("   "), null, "blank is no series");

// ── strip: dedupes editions, orders by position, flags gaps ─────────────
const lincoln = book({ id: "lincoln", title: "The Lincoln Lawyer", series_position: "1.0", status: "read", read_count: 2 });
const brass = book({ id: "brass", title: "The Brass Verdict", series_position: 2, status: "read", read_count: 2 });
const fifth = book({ id: "fifth", title: "The Fifth Witness", series_position: 4, status: "read", read_count: 2, cover_path: "u/fifth.jpg" });
const fifthAudio = book({ id: "fifth-audio", title: "The Fifth Witness", series_position: 4, status: "read", read_count: 1 });
const gods = book({ id: "gods", title: "The Gods of Guilt", series_position: 5, status: "currently-reading" });
const law = book({ id: "law", title: "The Law of Innocence", series_position: 6, cover_path: "u/law.jpg" });
const unnumbered = book({ id: "extra", title: "Haller Short Stories", series_position: null, published_year: 2015 });
const otherSeries = book({ id: "pickett", title: "Open Season", series: "Joe Pickett", series_position: 1 });
const magazine = book({ id: "mag", title: "Mickey Haller", series: "Mickey Haller", content_type: "magazine" });
const library = [law, otherSeries, fifthAudio, unnumbered, gods, magazine, brass, fifth, lincoln];

const strip = buildSeriesStrip(fifthAudio, library);
assert(strip, "a book in a series gets a strip");
assertEqual(strip!.name, "Mickey Haller", "series name");
assertEqual(strip!.volumes.length, 6, "two editions of #4 fold into one volume; magazine row excluded");
assertEqual(
  strip!.volumes.map((v) => v.position).join(","),
  "1,2,4,5,6,",
  "ordered by position, unnumbered last",
);
assertEqual(strip!.volumes[2].book.id, "fifth-audio", "open edition is the representative even without a cover");
assertEqual(strip!.volumes[2].editions.length, 2, "both editions kept");
assertEqual(strip!.volumes[2].isCurrent, true, "open book's volume is current");
assertEqual(strip!.volumes[4].isCurrent, false, "other volumes are not current");
assertEqual(strip!.readCount, 3, "read count counts volumes, not editions");
assertEqual(seriesSummary(strip!), "3 of 6 read", "summary");
assertEqual(strip!.nextPosition, 7, "next position is one past the highest");

const kinds = strip!.items.map((it) => (it.kind === "gap" ? `gap${it.position}` : String(it.position)));
assertEqual(kinds.join(","), "1,2,gap3,4,5,6,null", "missing #3 shows as a gap card");
assertEqual(strip!.currentIndex, 3, "current index accounts for the gap card");

const fromOther = buildSeriesStrip(lincoln, library);
assertEqual(fromOther!.volumes[2].book.id, "fifth", "when not open, the edition with a cover represents #4");

// ── no series / magazines / huge gaps ───────────────────────────────────
assertEqual(buildSeriesStrip(book({ title: "Standalone", series: null }), library), null, "no series, no strip");
assertEqual(buildSeriesStrip(magazine, library), null, "magazines never get a series strip");

const sparse = [
  book({ id: "s1", series: "Sparse", title: "One", series_position: 1 }),
  book({ id: "s2", series: "Sparse", title: "Fifty", series_position: 50 }),
];
const sparseStrip = buildSeriesStrip(sparse[0], sparse)!;
assertEqual(sparseStrip.items.length, 2, "48 missing volumes are not drawn as gap cards");

const novellas = [
  book({ id: "n1", series: "Pike Logan", title: "Prologue", series_position: 0.5 }),
  book({ id: "n2", series: "Pike Logan", title: "One Rough Man", series_position: 1 }),
  book({ id: "n3", series: "Pike Logan", title: "Two", series_position: 2 }),
];
const novellaStrip = buildSeriesStrip(novellas[1], novellas)!;
assertEqual(
  novellaStrip.items.map((it) => it.kind).join(","),
  "volume,volume,volume",
  "0.5 before 1 is not a gap",
);

assertEqual(
  librarySeriesNames(library).join("|"),
  "Mickey Haller|Joe Pickett",
  "series names ranked by volume count, magazines ignored",
);

console.log("book-series tests passed");
