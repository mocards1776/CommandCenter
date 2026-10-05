
const __mem = () => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(String(k), String(v)); },
    removeItem: (k) => { m.delete(k); },
    key: (i) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  };
};
if (typeof globalThis.localStorage === "undefined") globalThis.localStorage = __mem();
if (typeof globalThis.sessionStorage === "undefined") globalThis.sessionStorage = __mem();
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
const __ttEnv = globalThis.Deno && globalThis.Deno.env
  ? { url: globalThis.Deno.env.get("SUPABASE_URL") || "", key: globalThis.Deno.env.get("SUPABASE_ANON_KEY") || "" }
  : (globalThis.__TT_ENV || { url: "", key: "" });


// src/lib/newspaper.ts
var TZ = "America/Chicago";
var PRESS_HOURS = [
  { hour: 6, slot: "morning", label: "Morning Edition" },
  { hour: 12, slot: "midday", label: "Midday Edition" },
  { hour: 17, slot: "evening", label: "Evening Edition" }
];
var EDITION_HOUR = PRESS_HOURS[0].hour;
function centralHour(now) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "numeric",
    hourCycle: "h23"
  }).formatToParts(now);
  const hh = Number(parts.find((part) => part.type === "hour")?.value);
  if (!Number.isFinite(hh)) return 0;
  return hh % 24;
}
function shiftDay(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}
function editionDay(now = /* @__PURE__ */ new Date()) {
  return pressEdition(now).day;
}
function pressEdition(now = /* @__PURE__ */ new Date()) {
  const today = now.toLocaleDateString("en-CA", { timeZone: TZ });
  const hour = centralHour(now);
  const slot = [...PRESS_HOURS].reverse().find((p) => hour >= p.hour) ?? null;
  if (!slot) {
    const day = shiftDay(today, -1);
    const evening = PRESS_HOURS[PRESS_HOURS.length - 1];
    return { id: `${day}-${evening.slot}`, day, slot: evening.slot, label: evening.label, next: "6 a.m." };
  }
  const next = PRESS_HOURS.find((p) => p.hour > slot.hour);
  return {
    id: `${today}-${slot.slot}`,
    day: today,
    slot: slot.slot,
    label: slot.label,
    next: next ? next.hour === 12 ? "noon" : "5 p.m." : "6 a.m."
  };
}
function editionNewsDay(day = editionDay()) {
  return shiftDay(day, -1);
}
function instantDay(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-CA", { timeZone: TZ });
}
var EDITION_HOURS = 18;
var HOLDOVER_HOURS = 36;
function isDeskPress(pressId) {
  return pressId.endsWith("-midday") || pressId.endsWith("-evening");
}
var PRESS_ID = /^(\d{4}-\d{2}-\d{2})-(morning|midday|evening)$/;
function parsePressId(id) {
  const match = PRESS_ID.exec(id);
  if (!match) return null;
  const day = match[1];
  const slot = match[2];
  const spec = PRESS_HOURS.find((p) => p.slot === slot);
  if (!spec) return null;
  const next = PRESS_HOURS.find((p) => p.hour > spec.hour);
  return {
    id,
    day,
    slot,
    label: spec.label,
    next: next ? next.hour === 12 ? "noon" : "5 p.m." : "6 a.m."
  };
}
function pressInstant(pressId) {
  const match = /^(\d{4}-\d{2}-\d{2})(?:-(morning|midday|evening))?$/.exec(pressId);
  if (!match) return null;
  const day = match[1];
  const slot = match[2] ?? "morning";
  const hour = slot === "midday" ? 12 : slot === "evening" ? 17 : 6;
  const [y, m, d] = day.split("-").map(Number);
  if (!y || !m || !d) return null;
  for (const offset of [5, 6, 4]) {
    const dt = new Date(Date.UTC(y, m - 1, d, hour + offset, 0, 0));
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23"
    }).formatToParts(dt);
    const get = (type) => parts.find((part) => part.type === type)?.value ?? "";
    const gotDay = `${get("year")}-${get("month")}-${get("day")}`;
    if (gotDay === day && Number(get("hour")) % 24 === hour) return dt;
  }
  return null;
}
function withinEditionHours(iso, pressId) {
  const end = pressInstant(pressId);
  if (!end || !iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  const endMs = end.getTime();
  return t <= endMs && t >= endMs - EDITION_HOURS * 36e5;
}
function holdoverCovers(iso, pressId) {
  const end = pressInstant(pressId);
  if (!end || !iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  const endMs = end.getTime();
  return t <= endMs && t >= endMs - HOLDOVER_HOURS * 36e5;
}
function isGameWrapStory(card) {
  return /^(?:wire|recap|recent|wrap)-/.test(card.id);
}
function centralWeekday(day) {
  return (/* @__PURE__ */ new Date(`${day}T12:00:00Z`)).getUTCDay();
}
function previousSaturday(day) {
  const wd = centralWeekday(day);
  return shiftDay(day, wd === 6 ? -7 : -(wd + 1));
}
function asPressId(pressId) {
  return parsePressId(pressId) ? pressId : `${pressId}-morning`;
}
function gameWindowStart(pressId, leaguePath) {
  const parsed = parsePressId(asPressId(pressId));
  if (!parsed) return null;
  const { day, slot } = parsed;
  const wd = centralWeekday(day);
  if (leaguePath === "football/college-football") {
    if (slot !== "morning" && wd === 6) return pressInstant(`${day}-morning`);
    return pressInstant(`${previousSaturday(day)}-morning`);
  }
  if (slot === "morning" && wd === 1) return pressInstant(`${shiftDay(day, -2)}-morning`);
  if (slot === "morning") return pressInstant(`${shiftDay(day, -1)}-morning`);
  return pressInstant(`${day}-morning`);
}
function gameWrapCovers(iso, pressId, leaguePath) {
  const end = pressInstant(asPressId(pressId));
  const start = gameWindowStart(pressId, leaguePath);
  if (!end || !start || !iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return t <= end.getTime() && t >= start.getTime();
}
function isResultCopy(input) {
  const kind = `${input.type ?? ""} ${input.status ?? ""}`.toLowerCase();
  if (/\brecap\b/.test(kind)) return true;
  if (input.status && /final/i.test(input.status) && input.scoreLine && /\d/.test(input.scoreLine)) {
    return true;
  }
  const hay2 = `${input.headline ?? ""} ${input.dek ?? ""}`.toLowerCase();
  return /\bin (?:a |the )?(?:win|loss|defeat)\b/.test(hay2) || /\bwin (?:over|vs\.?|against)\b/.test(hay2) || /\b(?:beat|defeated|edged|routed|downed|topped) the\b/.test(hay2) || /\b(?:lifts|lifted)\b[^.]{0,48}\b(?:win|victory)\b/.test(hay2) || /\bposts? \d+ points\b/.test(hay2) || /\brecaps?\b/.test(hay2) || /\b\d{1,3}\s*[-–]\s*\d{1,3}\s+(?:win|loss|victory|defeat)\b/.test(hay2);
}
var NEWS_MUTED = /* @__PURE__ */ new Set(["eng-arsenal"]);
var NEWS_MUTED_NAMES = /\barsenal\b/i;
function isNewsMuted(card) {
  if (card.favoriteKey && NEWS_MUTED.has(card.favoriteKey)) return true;
  return NEWS_MUTED_NAMES.test(`${card.teamName ?? ""} ${card.headline ?? ""}`);
}
function favoriteDeskWeight(key) {
  if (key === "mlb-stl") return 100;
  if (key === "nhl-stl") return 100;
  if (key === "cfb-mizzou" || key === "cbb-mizzou") return 100;
  if (key === "nfl-det") return 70;
  if (key === "nfl-kc") return 50;
  if (key === "nfl-dal" || key === "nba-phi") return 45;
  if (key === "cfb-missouri-state" || key === "cbb-missouri-state") return 40;
  if (key === "eng-arsenal" || key === "eng-wrexham" || key === "eng-wolves") return 25;
  if (key.startsWith("eng-") || key.includes("soccer")) return 20;
  return 10;
}
function splitStoryCopy(text, teaserChars) {
  const raw = text.replace(/\s+/g, " ").trim();
  if (!raw) return { teaser: "", rest: "" };
  if (raw.length <= teaserChars) return { teaser: raw, rest: "" };
  const window = raw.slice(0, teaserChars + 80);
  const para = window.lastIndexOf("\n\n");
  const sentence = Math.max(
    window.lastIndexOf(". "),
    window.lastIndexOf("! "),
    window.lastIndexOf("? ")
  );
  const space = window.lastIndexOf(" ");
  let cut = teaserChars;
  if (para >= teaserChars * 0.45) cut = para;
  else if (sentence >= teaserChars * 0.55) cut = sentence + 1;
  else if (space >= teaserChars * 0.6) cut = space;
  const teaser = raw.slice(0, cut).trim();
  const rest = raw.slice(cut).trim();
  if (rest.length < 120) return { teaser: raw, rest: "" };
  return { teaser, rest };
}

// ../supabase/functions/_shared/newspaper-paras.ts
var MIN_PARA = 25;
var ABBREVS = /* @__PURE__ */ new Set([
  "u.s",
  "u.k",
  "u.n",
  "d.c",
  "sen",
  "rep",
  "gov",
  "gen",
  "lt",
  "col",
  "dr",
  "mr",
  "mrs",
  "ms",
  "st",
  "jr",
  "sr",
  "inc",
  "co",
  "corp",
  "no",
  "vs",
  "jan",
  "feb",
  "mar",
  "apr",
  "jun",
  "jul",
  "aug",
  "sept",
  "sep",
  "oct",
  "nov",
  "dec",
  "ala",
  "ariz",
  "ark",
  "calif",
  "colo",
  "conn",
  "del",
  "fla",
  "ga",
  "ill",
  "ind",
  "kan",
  "ky",
  "la",
  "md",
  "mass",
  "mich",
  "minn",
  "miss",
  "mo",
  "mont",
  "neb",
  "nev",
  "okla",
  "ore",
  "pa",
  "tenn",
  "tex",
  "va",
  "wash",
  "wis",
  "wyo"
]);
function isAbbreviationPeriod(text, i) {
  if (text[i] !== ".") return false;
  let start = i;
  while (start > 0 && /[A-Za-z.]/.test(text[start - 1])) start--;
  const token = text.slice(start, i).replace(/^\.+|\.+$/g, "");
  if (!token) return false;
  if (ABBREVS.has(token.toLowerCase())) return true;
  if (/^[A-Z]$/.test(token)) return true;
  if (/^(?:[A-Za-z]\.)+[A-Za-z]$/.test(token)) return true;
  return false;
}
function splitNewspaperSentences(text) {
  const raw = text.replace(/\s+/g, " ").trim();
  if (!raw) return [];
  const parts = [];
  let start = 0;
  const re = /[.!?]["'”’)\]]*/g;
  let match;
  while (match = re.exec(raw)) {
    const end = match.index + match[0].length;
    const after = raw.slice(end);
    const space = after.match(/^\s+/)?.[0] ?? "";
    const next = after.slice(space.length);
    if (!next || !/^["“‘'(]*[A-Z0-9]/.test(next)) continue;
    if (isAbbreviationPeriod(raw, match.index)) continue;
    const sentence = raw.slice(start, end).trim();
    if (sentence) parts.push(sentence);
    start = end + space.length;
  }
  const tail = raw.slice(start).trim();
  if (tail) parts.push(tail);
  return parts.length ? parts : [raw];
}
function mergeShortNewspaperParas(paras, min = MIN_PARA) {
  const out = [];
  for (const raw of paras) {
    const para = raw.replace(/\s+/g, " ").trim();
    if (!para) continue;
    if (out.length && out[out.length - 1].length < min) {
      out[out.length - 1] = `${out[out.length - 1]} ${para}`;
    } else {
      out.push(para);
    }
  }
  if (out.length >= 2 && out[out.length - 1].length < min) {
    const last = out.pop();
    out[out.length - 1] = `${out[out.length - 1]} ${last}`;
  }
  return out;
}
function newspaperParas(input, max = 60) {
  const blocks = typeof input === "string" ? input.trim() ? input.split(/\n{2,}/).map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean).flatMap((block) => splitNewspaperSentences(block)) : [] : input.map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean);
  return mergeShortNewspaperParas(blocks).slice(0, max);
}

// src/lib/newspaper-copy.ts
var NAV_MARKERS = ["my quiz activity", "my favorites", "add sports/teams", "home quizzes"];
function isNavSoup(text) {
  const raw = (text ?? "").replace(/\s+/g, " ").trim();
  if (raw.length < 80) return false;
  const lower = raw.toLowerCase();
  if (NAV_MARKERS.some((marker) => lower.includes(marker))) return true;
  const words = raw.split(" ").length;
  const endings = (raw.match(/[.!?](?=\s|$)/g) ?? []).length;
  const commas = (raw.match(/,/g) ?? []).length;
  return words >= 50 && endings === 0 && commas < 2;
}
var KILLED_HOSTS = ["yardbarker.com", "viralsportsnews.com", "yb.com"];
function killedSource(url) {
  if (!url) return false;
  const raw = url.trim().toLowerCase();
  let host = raw;
  try {
    host = new URL(raw).hostname.replace(/^www\./, "");
  } catch {
  }
  return KILLED_HOSTS.some((killed) => host === killed || host.endsWith(`.${killed}`) || raw.includes(killed));
}
var JUNK_CUT = /\b(?:more must-reads|related stories|receive daily headlines|kicker:\s*headline|sign up today|recaptcha|all rights reserved|you may also like|recommended for you)\b/i;
function decodeNewspaperEntities(text) {
  return text.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16))).replace(/&nbsp;/gi, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&apos;|&#0*39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&[lr]squo;/gi, "\u2019").replace(/&[lr]dquo;/gi, "\u201D").replace(/&ndash;/gi, "\u2013").replace(/&mdash;/gi, "\u2014");
}
function looksLikeHtml(text) {
  return /<\/?[a-z][\s\S]*>/i.test(text);
}
function collapseInline(text) {
  return text.replace(/[^\S\n]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}
function joinBrokenDecimals(text) {
  let out = text.replace(/(\d)\.\s+(\d)/g, "$1.$2");
  out = out.replace(/\b(above|below|under|over|from|to|than)\.\s+(\d{3})\b/gi, "$1 .$2");
  return out;
}
function stripGettyCredit(text) {
  return text.replace(/\s*\((?:Getty(?:\s+Images)?|getty images)\)/gi, "").replace(/^\s*(?:Getty(?:\s+Images)?)\s*$/i, "").replace(/\s{2,}/g, " ").trim();
}
var BOILERPLATE_LINE = /^(?:-{3,}|_{3,}|\*{3,}|sign up for\b|subscribe:|jump to:|posted in\b|share this:|to read this\b|click here\b|download the app\b|follow us on\b|read more\b|advertisement\b|related stories\b|you may also like\b)/i;
var BOILERPLATE_GETTY = /^\(?getty(?:\s+images)?\)?\.?$/i;
function isBoilerplateLine(line) {
  const t = line.replace(/\s+/g, " ").trim();
  if (!t) return true;
  if (BOILERPLATE_GETTY.test(t)) return true;
  if (BOILERPLATE_LINE.test(t)) return true;
  if (/^sign up for\b/i.test(t) && /\balerts?\b/i.test(t)) return true;
  return false;
}
function stripBoilerplateCopy(text) {
  return text.split(/\n{2,}|\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter((line) => !isBoilerplateLine(line)).join("\n\n").trim();
}
function htmlToNewspaperText(html) {
  if (!html.trim()) return "";
  let raw = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<br\s*\/?>/gi, "\n");
  const blocks = [];
  const re = /<(p|h[1-6]|li|blockquote|div)\b[^>]*>[\s\S]*?<\/\1>/gi;
  let match;
  let last = 0;
  while (match = re.exec(raw)) {
    const before = raw.slice(last, match.index);
    if (before.replace(/<[^>]+>/g, " ").trim()) {
      blocks.push(before);
    }
    blocks.push(match[0]);
    last = match.index + match[0].length;
  }
  if (last < raw.length) blocks.push(raw.slice(last));
  const paras = (blocks.length ? blocks : [raw]).map((block) => {
    const text = decodeNewspaperEntities(block.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
    return text;
  }).filter(Boolean);
  return paras.join("\n\n").trim();
}
function tidy(text) {
  return joinBrokenDecimals(
    decodeNewspaperEntities(stripGettyCredit(text)).replace(/\s+([,;:!?])/g, "$1").replace(/\s+\.(?!\d)/g, ".").replace(/(\w)\s+([’'])/g, "$1$2").replace(/([‘'])\s+(\w)/g, "$1$2").replace(/(["“])\s+/g, "$1").replace(/\s+(["”])/g, "$1").replace(/\(\s+/g, "(").replace(/\s+\)/g, ")")
  ).replace(/[^\S\n]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}
function stripModules(text) {
  return collapseInline(
    text.replace(
      /\bWE ASKED OUR REPORTERS\b.{0,1400}?(?=\s(?:Now|The|But|If|Asked|He|She|They|In|When|After|Before|It|That|This|So)\b)/i,
      " "
    ).replace(/\bKey links:\s*.+$/i, " ")
  );
}
var BYLINE = /^(?:By\s+)?([A-Z][A-Za-z.'’-]{1,24}(?:\s+[A-Z][A-Za-z.'’-]{1,24}){0,3})\s*\|\s*(?:St\.?\s*Louis\s+)?(?:Post-Dispatch|Post Dispatch|The Athletic|ESPN|Associated Press|Semissourian)\b\s*/;
function liftByline(text) {
  const match = BYLINE.exec(text);
  if (!match?.[1]) return { author: null, text };
  return { author: match[1], text: text.slice(match[0].length).trim() };
}
function stripLeadingMenu(text) {
  const end = text.search(/[.!?](?=\s|$)/);
  if (end < 120) return text;
  const lead = text.slice(0, end);
  const words = lead.split(" ").filter(Boolean);
  const commas = (lead.match(/,/g) ?? []).length;
  if (words.length >= 30 && commas < 2) return text.slice(end + 1).trim();
  return text;
}
function prepareCopy(text) {
  let raw = text ?? "";
  if (!raw.trim()) return "";
  if (looksLikeHtml(raw)) raw = htmlToNewspaperText(raw);
  else raw = decodeNewspaperEntities(raw);
  raw = stripBoilerplateCopy(raw);
  const paras = raw.split(/\n{2,}/).map((p) => tidy(p.replace(/\s+/g, " "))).filter((p) => p && !isBoilerplateLine(p));
  return paras.join("\n\n");
}
function cleanStoryCopy(text) {
  let raw = prepareCopy(text);
  if (!raw) return { author: null, text: "" };
  const keepBreaks = raw.includes("\n\n");
  const line = raw.replace(/\s+/g, " ").trim();
  const cut = line.search(JUNK_CUT);
  let working = cut >= 0 ? line.slice(0, cut).trim() : line;
  working = stripModules(working);
  working = stripLeadingMenu(working);
  const lifted = liftByline(working);
  working = lifted.text;
  if (!working || isNavSoup(working)) return { author: lifted.author, text: "" };
  if (keepBreaks && cut < 0) {
    const paras = raw.split(/\n{2,}/).map((p) => tidy(p)).filter((p) => p && !isBoilerplateLine(p) && !JUNK_CUT.test(p));
    working = paras.join("\n\n") || working;
    const again = liftByline(working.replace(/\s+/g, " ").trim());
    if (again.author) {
      working = working.replace(BYLINE, "").trim();
      return { author: again.author, text: collapseInline(working) };
    }
  }
  return { author: lifted.author, text: collapseInline(working) };
}
var PERIPHERAL = /\b(?:youth|on-field experience|treated to|sign up today|photo gallery|submitted by|fan experience)\b/i;
function isPeripheralClubStory(card) {
  if (!PERIPHERAL.test(`${card.headline} ${card.dek ?? ""}`)) return false;
  const head = card.headline.toLowerCase();
  const tokens = (card.teamName ?? "").toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length >= 4);
  return !tokens.some((word) => head.includes(word));
}

// src/lib/newspaper-source.ts
var OUTLETS = [
  [/(^|\.)stltoday\.com$/, "St. Louis Post-Dispatch"],
  [/(^|\.)(theathletic\.com|nytimes\.com)$/, "The Athletic"],
  [/(^|\.)espn\.com$/, "ESPN"],
  [/(^|\.)apnews\.com$/, "The Associated Press"],
  [/(^|\.)mlb\.com$/, "MLB.com"],
  [/(^|\.)nhl\.com$/, "NHL.com"],
  [/(^|\.)nfl\.com$/, "NFL.com"],
  [/(^|\.)nba\.com$/, "NBA.com"],
  [/(^|\.)ncaa\.com$/, "NCAA.com"],
  [/(^|\.)vivaelbirdos\.com$/, "Viva El Birdos"],
  [/(^|\.)stlouisgametime\.com$/, "St. Louis Game Time"],
  [/(^|\.)arrowheadpride\.com$/, "Arrowhead Pride"],
  [/(^|\.)prideofdetroit\.com$/, "Pride of Detroit"],
  [/(^|\.)rockmnation\.com$/, "Rock M Nation"],
  [/(^|\.)bloggingtheboys\.com$/, "Blogging The Boys"],
  [/(^|\.)libertyballers\.com$/, "Liberty Ballers"],
  [/^cardswire\.usatoday\.com$/, "Cardinals Wire"],
  [/^chiefswire\.usatoday\.com$/, "Chiefs Wire"],
  [/^lionswire\.usatoday\.com$/, "Lions Wire"],
  [/^cowboyswire\.usatoday\.com$/, "Cowboys Wire"],
  [/(^|\.)usatoday\.com$/, "USA Today"],
  [/(^|\.)kansascity\.com$/, "The Kansas City Star"],
  [/(^|\.)freep\.com$/, "Detroit Free Press"],
  [/(^|\.)detroitnews\.com$/, "The Detroit News"],
  [/(^|\.)dallasnews\.com$/, "The Dallas Morning News"],
  [/(^|\.)inquirer\.com$/, "The Philadelphia Inquirer"],
  [/(^|\.)columbiamissourian\.com$/, "Columbia Missourian"],
  [/(^|\.)news-leader\.com$/, "Springfield News-Leader"],
  [/(^|\.)missouriindependent\.com$/, "Missouri Independent"],
  [/(^|\.)missourinet\.com$/, "Missourinet"],
  [/(^|\.)stlpr\.org$/, "St. Louis Public Radio"],
  [/(^|\.)ksdk\.com$/, "KSDK"],
  [/(^|\.)fox2now\.com$/, "FOX 2"],
  [/(^|\.)kmov\.com$/, "KMOV"],
  [/(^|\.)kshb\.com$/, "KSHB"],
  [/(^|\.)komu\.com$/, "KOMU"],
  [/(^|\.)cbssports\.com$/, "CBS Sports"],
  [/(^|\.)foxsports\.com$/, "FOX Sports"],
  [/(^|\.)si\.com$/, "Sports Illustrated"],
  [/(^|\.)yahoo\.com$/, "Yahoo Sports"],
  [/(^|\.)nbcsports\.com$/, "NBC Sports"],
  [/(^|\.)bleacherreport\.com$/, "Bleacher Report"],
  [/(^|\.)fansided\.com$/, "FanSided"],
  [/(^|\.)on3\.com$/, "On3"],
  [/(^|\.)247sports\.com$/, "247Sports"],
  [/(^|\.)rotowire\.com$/, "RotoWire"],
  [/(^|\.)bbc\.(co\.uk|com)$/, "BBC Sport"],
  [/(^|\.)theguardian\.com$/, "The Guardian"],
  [/(^|\.)skysports\.com$/, "Sky Sports"]
];
function hostOf(url) {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}
function outletFor(url) {
  const host = hostOf(url);
  if (!host) return null;
  for (const [re, name] of OUTLETS) if (re.test(host)) return name;
  return null;
}
function storySource(card) {
  if (card.wrapKind === "box" || card.caption === "Times box wrap") return "Times box wrap";
  const outlet = outletFor(card.wrapHref) ?? outletFor(card.feedUrl) ?? outletFor(card.gameHref);
  if (outlet === "ESPN" && /\bAP\b|Associated Press/.test(card.body?.slice(-400) ?? "")) return "The Associated Press";
  if (outlet) return outlet;
  const host = hostOf(card.wrapHref) ?? hostOf(card.feedUrl);
  if (!host || host.endsWith("rss.app")) return null;
  const base = host.split(".").slice(-2, -1)[0] ?? host;
  return base.charAt(0).toUpperCase() + base.slice(1);
}

// src/lib/newspaper-sport-desk.ts
function isPreviewCard(card) {
  if (card.status && /\b(scheduled|pre-?game|preview)\b/i.test(card.status)) return true;
  if (card.wrapHref && /\/preview\b/i.test(card.wrapHref)) return true;
  if (/\bBOTTOM LINE:|\bLINE:\s|Data Skrive/.test(card.body ?? "")) return true;
  const head = `${card.headline} ${card.dek ?? ""}`;
  return /\b(hosts?|visits?|face|take on|meet)\b.*\bto (start|open|begin|kick off)\b/i.test(head) || /\b(preview|what to watch|how to watch|keys to the game|prediction)\b/i.test(card.headline);
}
var SPORT_NEWS_CAP = 8;
var VIDEO = /\b(game highlights?|highlights?|watch now|must-see|viral clip|film room|watch:)\b/i;
var FANTASY = /\b(fantasy|dfs|draftkings|sleeper pick|start.?em|sit.?em)\b/i;
var BETTING = /\b(betting|odds|spread|over-?under|prop bet|picks? and parlays?|best bets?|moneyline)\b/i;
var PODCAST = /\b(podcast|pod\b|listen now|episode \d+)\b/i;
var LISTICLE = /^(?:\d+\s+(?:things|plays|moments|takeaways|reasons|signs)|here are \d+|the \d+ (?:best|worst|biggest)|things we learned|week \d+ power rankings)\b/i;
function hay(card) {
  return `${card.headline} ${card.dek ?? ""} ${card.status ?? ""} ${card.wrapHref ?? ""} ${card.feedUrl ?? ""}`;
}
function isGameWrapCard(card) {
  return isGameWrapStory(card);
}
function sportFillerReason(card, recaps = []) {
  if (isGameWrapCard(card)) return null;
  const text = hay(card);
  const href = `${card.wrapHref ?? ""} ${card.feedUrl ?? ""}`;
  if (card.status && /\b(video|media)\b/i.test(card.status)) return "video";
  if (/\/video\b|\/clip\b|watch\.espn/i.test(href) || VIDEO.test(text)) return "video";
  if (FANTASY.test(text)) return "fantasy";
  if (BETTING.test(text)) return "betting";
  if (PODCAST.test(text) || /\/podcast/i.test(href)) return "podcast";
  if (LISTICLE.test(card.headline.trim())) return "listicle";
  if (isPreviewCard(card) && recaps.some((wrap) => sameGameStory(card, wrap))) return "preview";
  return null;
}
function isSportFiller(card, recaps = []) {
  return sportFillerReason(card, recaps) != null;
}
function storyFitsSection(card, path) {
  if (!card.leaguePath) return true;
  return card.leaguePath === path;
}
function eventIdOf(card) {
  const raw = card.gameId ?? "";
  const fromId = raw.match(/(\d{6,})/)?.[1];
  if (fromId) return fromId;
  const href = `${card.wrapHref ?? ""} ${card.gameHref ?? ""}`;
  return href.match(/(?:gameId|event)[=/](\d{6,})/i)?.[1] ?? null;
}
function teamTokens(card) {
  return `${card.headline} ${card.scoreLine ?? ""} ${card.teamName}`.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length >= 4);
}
function sameGameStory(a, b) {
  const idA = eventIdOf(a);
  const idB = eventIdOf(b);
  if (idA && idB && idA === idB) return true;
  if (a.scoreLine && b.scoreLine && a.scoreLine === b.scoreLine && a.leaguePath === b.leaguePath) {
    return true;
  }
  const ta = new Set(teamTokens(a));
  const tb = teamTokens(b);
  const shared = tb.filter((w) => ta.has(w));
  return shared.length >= 2 && Boolean(a.scoreLine || b.scoreLine || isGameWrapCard(a) || isGameWrapCard(b));
}
function recapScore(card) {
  return (card.favoriteKey || card.followed ? 1e4 + favoriteDeskWeight(card.favoriteKey) : 0) + (card.postseason ? 5e3 : 0) + (card.ranked ? 2e3 : 0) + (card.sec ? 1500 : 0) + Math.min(400, Math.floor((card.body?.length ?? 0) / 10));
}
function bySignificance(a, b) {
  const diff = recapScore(b) - recapScore(a);
  if (diff) return diff;
  return String(a.when ?? "").localeCompare(String(b.when ?? ""));
}
function isSecCard(card) {
  if (card.leaguePath && card.leaguePath !== "football/college-football") return false;
  if (card.sec) return true;
  if (card.favoriteKey === "cfb-mizzou") return true;
  return false;
}
function isFreshSectionLead(card, path, edition) {
  if (card.holdover) return false;
  if (isGameWrapCard(card) || card.scoreLine && /\d/.test(card.scoreLine)) {
    return gameWrapCovers(card.when, edition, path);
  }
  return true;
}
function orderSportSectionFront(cards, path, edition) {
  const seen = /* @__PURE__ */ new Set();
  const unique = cards.filter((card) => {
    if (seen.has(card.id)) return false;
    seen.add(card.id);
    return true;
  });
  const fresh = unique.filter((card) => isFreshSectionLead(card, path, edition));
  const pool = fresh.length ? fresh : unique;
  const editorLead = pool.find((card) => card.editorFront === 0);
  const wraps = orderSportRecaps(
    pool.filter((card) => isGameWrapCard(card) || Boolean(card.scoreLine && /\d/.test(card.scoreLine))),
    path
  );
  const news = pool.filter((card) => !isGameWrapCard(card) && !(card.scoreLine && /\d/.test(card.scoreLine))).sort((a, b) => (a.editorRank ?? 99) - (b.editorRank ?? 99) || String(b.when ?? "").localeCompare(String(a.when ?? "")));
  const lead = editorLead ?? wraps[0] ?? news[0] ?? pool[0];
  if (!lead) return [];
  const rest = pool.filter((card) => card.id !== lead.id);
  const withPhoto = rest.filter((card) => card.photo);
  const without = rest.filter((card) => !card.photo);
  return [lead, ...withPhoto, ...without];
}
function orderSportRecaps(cards, path) {
  const fav = cards.filter((c) => c.favoriteKey || c.followed).sort(bySignificance);
  const rest = cards.filter((c) => !c.favoriteKey && !c.followed);
  if (path === "football/college-football") {
    const sec = rest.filter(isSecCard).sort(bySignificance);
    const other2 = rest.filter((c) => !isSecCard(c)).sort(bySignificance);
    return [...fav, ...sec, ...other2];
  }
  const marquee = rest.filter((c) => c.postseason || c.ranked).sort(bySignificance);
  const other = rest.filter((c) => !c.postseason && !c.ranked).sort(bySignificance);
  return [...fav, ...marquee, ...other];
}

// src/lib/newspaper-missouri.ts
var PROMO_MARK = /\b(advertorial|sponsored content|presented by|paid (?:content|post)|partner content|click for full story)\b/i;
var PROMO_SERIES = /\b(debt collection series|how to collect debt|empathy in debt collection|delinquent debtor)\b/i;
var PROMO_PATH = /johncombestblog\.com|blogcategory=debt|\/f\/(?:empathy-in-debt|how-to-collect-debt)/i;
function isPromoMissouriItem(item) {
  const hay2 = `${item.source ?? ""} ${item.headline} ${item.url}`;
  if (PROMO_PATH.test(item.url) || PROMO_PATH.test(hay2)) return true;
  if (PROMO_MARK.test(hay2) || PROMO_SERIES.test(hay2)) return true;
  if (/^combest$/i.test(item.source ?? "") && /johncombestblog\.com/i.test(item.url)) return true;
  return false;
}
var COMMON = new Set(
  "missouri missouri's state states house senate says would could should after about their there federal county counties school schools bill bills court new year years week first public plan plans report city louis kansas".split(
    " "
  )
);

// ../supabase/functions/_shared/national-news.ts
var NATIONAL_PAGE_BUDGET = 170;
var NATIONAL_PAGE_CAP = 4;
function nationalStorySize(indexOnPage) {
  if (indexOnPage <= 0) return "lead";
  if (indexOnPage < 3) return "medium";
  return "col";
}
var PAGE_COPY = {
  lead: { grafs: 6, chars: 1100 },
  medium: { grafs: 4, chars: 640 },
  col: { grafs: 3, chars: 420 }
};
function nationalPageCopy(story, size) {
  const raw = (story.body && story.body.trim().length >= 80 ? story.body : null) ?? (story.paragraphs?.length ? story.paragraphs.join("\n\n") : story.summary);
  const paras = newspaperParas(raw);
  if (!paras.length) return [];
  const cap = PAGE_COPY[size];
  const out = [];
  let n = 0;
  for (const p of paras) {
    if (out.length >= cap.grafs || n >= cap.chars) break;
    out.push(p);
    n += p.length;
  }
  return out.length ? out : paras.slice(0, 1);
}
function nationalStoryWeight(story, size) {
  const copy = nationalPageCopy(story, size).join(" ").length;
  const photo = story.imageUrl ? size === "lead" ? 32 : size === "medium" ? 18 : 10 : 0;
  const head = size === "lead" ? 10 : 6;
  return head + photo + Math.max(4, Math.ceil(copy / 28));
}
function packNationalPages(stories) {
  if (!stories.length) return [];
  const pages = [];
  let i = 0;
  while (i < stories.length) {
    const start = i;
    const batch = [stories[i]];
    let used = nationalStoryWeight(stories[i], "lead");
    i += 1;
    while (i < stories.length) {
      const size = nationalStorySize(batch.length);
      const w = nationalStoryWeight(stories[i], size);
      if (used + w > NATIONAL_PAGE_BUDGET && batch.length >= 3) break;
      batch.push(stories[i]);
      used += w;
      i += 1;
      if (used >= NATIONAL_PAGE_BUDGET && batch.length >= 3) break;
    }
    pages.push({ stories: batch, startIndex: start });
    if (pages.length >= NATIONAL_PAGE_CAP && i < stories.length) {
      pages[pages.length - 1].stories.push(...stories.slice(i));
      break;
    }
  }
  return pages;
}

// src/lib/newspaper-box.ts
var MLB_HYDRATE = [
  "linescore",
  "decisions",
  "probablePitcher(stats(group=[pitching],type=[season]))",
  "team",
  "seriesStatus",
  "broadcasts(all)",
  "venue",
  "game(content(editorial(recap)))"
].join(",");

// src/lib/newspaper-favorite-coaches.ts
var FAVORITE_COACHES_PRINT = {
  monday: "always",
  sunday: "cfb-season"
};
var CFB_SEASON_WINDOW = {
  startMonth: 8,
  startDay: 1,
  endMonth: 1,
  endDay: 20
};
function editionDayOf(pressId) {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(pressId);
  return m ? m[1] : null;
}
function favoriteCoachesWeekday(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const dt = /* @__PURE__ */ new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.getUTCDay();
}
function isCfbSeasonDay(day) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return false;
  const month = Number(m[2]);
  const date = Number(m[3]);
  const { startMonth, startDay, endMonth, endDay } = CFB_SEASON_WINDOW;
  if (month > startMonth || month === startMonth && date >= startDay) return true;
  if (month < endMonth || month === endMonth && date <= endDay) return true;
  return false;
}
function printsFavoriteCoaches(pressId) {
  const day = editionDayOf(pressId);
  if (!day) return false;
  const weekday = favoriteCoachesWeekday(day);
  if (weekday == null) return false;
  if (weekday === 1 && FAVORITE_COACHES_PRINT.monday === "always") return true;
  if (weekday === 0 && FAVORITE_COACHES_PRINT.sunday === "cfb-season") return isCfbSeasonDay(day);
  return false;
}

// src/lib/newspaper-sections.ts
var LEAD_TEASER = 1050;
var SECOND_TEASER = 720;
var THIRD_TEASER = 700;
var KNOWN = {
  "baseball/mlb": { code: "MLB", title: "Major League Baseball", order: 10 },
  "football/nfl": { code: "NFL", title: "National Football League", order: 20 },
  "football/college-football": { code: "CFB", title: "College Football", order: 30 },
  "hockey/nhl": { code: "NHL", title: "National Hockey League", order: 40 },
  "basketball/nba": { code: "NBA", title: "National Basketball Association", order: 45 },
  "basketball/mens-college-basketball": { code: "CBB", title: "College Basketball", order: 50 },
  "soccer/eng.1": { code: "EPL", title: "Premier League", order: 60 },
  "soccer/eng.2": { code: "EFL", title: "EFL Championship", order: 70 }
};
var SECTION_A_TITLE = "The Essentials";
function sportInSeason(path, day, now = day) {
  const stamp = (now || day).slice(0, 10);
  const month = Number(stamp.slice(5, 7));
  const date = Number(stamp.slice(8, 10));
  if (!month || !date) return true;
  switch (path) {
    case "football/nfl":
      return month >= 9 || month <= 2;
    case "football/college-football":
      return month > 8 || month === 1 || month === 8 && date >= 20;
    case "baseball/mlb":
      return month >= 3 && month <= 10;
    case "hockey/nhl":
      return month >= 10 || month <= 6;
    case "basketball/nba":
      return month >= 11 || month <= 6 || month === 10 && date >= 22;
    case "basketball/mens-college-basketball":
      return month >= 11 || month <= 4;
    case "soccer/eng.1":
    case "soccer/eng.2":
      return month >= 8 || month <= 5;
    default:
      return true;
  }
}
function orderSportSections(ids, day) {
  return [...ids].sort((a, b) => {
    const season = Number(sportInSeason(b.path, day)) - Number(sportInSeason(a.path, day));
    if (season) return season;
    return a.order - b.order || a.code.localeCompare(b.code);
  });
}
var MIN_SECTION_PAGES = 5;
function sportSectionId(path) {
  const known = KNOWN[path];
  if (known) return { path, ...known };
  const slug = path.split("/").pop() ?? "sport";
  const letters = slug.replace(/[^a-z]/gi, "").toUpperCase().slice(0, 4) || "SP";
  const title = slug.replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return { path, code: letters, title, order: 200 };
}
function isFavoriteStory(card) {
  return Boolean(card.favoriteKey || card.followed);
}
function isEssentialsDesk(card) {
  return card.sportLabel === "National" || card.sportLabel === "Missouri";
}
var HISTORIC_NATIONAL_STATUS = "historic-national";
var HISTORIC_NATIONAL = new RegExp(
  [
    String.raw`assassinat`,
    String.raw`attempt on (?:the )?(?:u\.?s\.? )?(?:president|vice[- ]president)`,
    String.raw`(?:president|vice[- ]president)\S{0,24}(?:is |was |has been )?(?:shot|wounded|killed)`,
    String.raw`(?:shot|wounded|killed) (?:the )?(?:u\.?s\.? )?(?:president|vice[- ]president)`,
    String.raw`declares? war`,
    String.raw`war (?:has )?begun`,
    String.raw`war breaks? out`,
    String.raw`full-scale invasion`,
    String.raw`launches? (?:a |an |its )?(?:full-scale )?invasion`,
    String.raw`\binvades\b`,
    String.raw`terror(?:ist)? attack`,
    String.raw`suicide bomb`,
    String.raw`mass-casualty (?:attack|bombing)`,
    String.raw`landmark (?:supreme court |scotus )?(?:ruling|decision|opinion|holding)`,
    String.raw`(?:supreme court|scotus) (?:overturns?|strikes? down)`,
    String.raw`(?:stock[- ]?)?market crash`,
    String.raw`markets? crash`,
    String.raw`category [45] hurricane`,
    String.raw`magnitude \d+(?:\.\d+)? earthquake`,
    String.raw`(?:devastating|deadliest|catastrophic) (?:hurricane|earthquake|tsunami|wildfire|tornado|flood)`,
    String.raw`president (?:resigns|steps down|leaves office)`,
    String.raw`(?:25th|twenty-fifth) amendment`,
    String.raw`removed from office`,
    String.raw`sworn in as president`,
    String.raw`takes? the oath of office`
  ].join("|"),
  "i"
);
function isHistoricNationalCard(card) {
  return card.sportLabel === "National" && card.status === HISTORIC_NATIONAL_STATUS;
}
function isSectionAStory(card) {
  if (isFavoriteStory(card) || card.sportLabel === "Missouri") return true;
  if (isHistoricNationalCard(card)) return true;
  return isMajorStory(card);
}
function isAthleticCard(card) {
  if (card.caption === "The Athletic" || card.id.startsWith("athletic-")) return true;
  const href = `${card.feedUrl ?? ""} ${card.wrapHref ?? ""}`;
  return /theathletic\.com|\/athletic\/rss\//i.test(href);
}
function isDeskStory(card) {
  if (killedSource(card.wrapHref) || killedSource(card.feedUrl) || killedSource(card.gameHref)) return false;
  if (isPeripheralClubStory(card)) return false;
  if (isEssentialsDesk(card)) return Boolean(card.headline);
  if (isAthleticCard(card)) return Boolean(card.headline && card.leaguePath);
  if (card.id.startsWith("league-")) return Boolean(card.headline && card.leaguePath);
  if (isGameWrapStory(card)) {
    if (card.status && /final|postponed/i.test(card.status) && card.scoreLine && /\d/.test(card.scoreLine)) {
      return true;
    }
    return cleanStoryCopy(card.body).text.length >= 80;
  }
  if (!isFavoriteStory(card)) return false;
  if (card.id.startsWith("news-")) return Boolean(card.headline);
  if (cleanStoryCopy(card.body).text.length >= 80) return true;
  if (card.status && /final|postponed/i.test(card.status) && card.scoreLine && /\d/.test(card.scoreLine)) {
    return true;
  }
  return false;
}
var STORY_COPY_MIN = 400;
function hasStoryCopy(card) {
  return cleanStoryCopy(card.body).text.length >= STORY_COPY_MIN;
}
function isRecapStory(card) {
  return isResultCopy({
    headline: card.headline,
    dek: card.dek,
    status: card.status,
    scoreLine: card.scoreLine,
    type: card.id.startsWith("news-") || card.id.startsWith("league-") ? card.status : null
  });
}
function isPreviewStory(card) {
  if (card.status && /\b(scheduled|pre-?game|preview)\b/i.test(card.status)) return true;
  if (card.wrapHref && /\/preview\b/i.test(card.wrapHref)) return true;
  const body = card.body ?? "";
  if (/\bBOTTOM LINE:|\bLINE:\s|Data Skrive/.test(body)) return true;
  const head = `${card.headline} ${card.dek ?? ""}`;
  return /\b(hosts?|visits?|face|take on|meet)\b.*\bto (start|open|begin|kick off)\b/i.test(head) || /\b(preview|what to watch|how to watch|keys to the game|prediction)\b/i.test(card.headline);
}
function isBettingPreview(card) {
  const head = `${card.headline} ${card.dek ?? ""}`;
  return /\bhow to bet\b|\bprop plays?\b|\bbetting (?:lines?|tips?|preview|odds)\b|\bagainst the spread\b|\bpicks and props\b|\btop prop\b|\bmoneyline\b|\bover\/under\b|\b(odds|spreads?) to (?:bet|know|watch)\b/i.test(
    head
  );
}
function isStaleGamePreview(card, pool) {
  if (!isPreviewStory(card) && !isBettingPreview(card)) return false;
  return pool.some(
    (other) => other.id !== card.id && shareMatchup(card, other) && (isRecapStory(other) || isGameRecapCopy(other) || isGameWrap(other) || Boolean(other.status && /final/i.test(other.status)))
  );
}
function cannotLeadFront(card, pool = []) {
  if (isHoldoverGame(card)) return true;
  if (isBettingPreview(card)) return true;
  if (pool.length && isStaleGamePreview(card, pool)) return true;
  if (isPreviewStory(card)) return true;
  return false;
}
function leadReplacement(bad, pool, taken) {
  const recap = pool.find(
    (c) => !taken.has(c.id) && c.id !== bad.id && shareMatchup(c, bad) && (isRecapStory(c) || isGameRecapCopy(c) || isGameWrap(c)) && hasStoryCopy(c)
  );
  return recap ?? null;
}
function storyRank(card, edition) {
  const day = card.when ? instantDay(card.when) : null;
  let score = 0;
  if (isBettingPreview(card)) score -= 250;
  if (isPreviewStory(card)) score -= 150;
  if (day === editionNewsDay(edition) && card.status && /final/i.test(card.status)) score += 100;
  if (card.postseason) score += 40;
  if (card.id.startsWith("news-")) score += 25;
  if (card.id.startsWith("league-")) score += 10;
  if (isAthleticCard(card)) score += 12;
  if (isRecapStory(card)) score += 20;
  if (cleanStoryCopy(card.body).text.length >= 400) score += 15;
  if (typeof card.listRank === "number") score += Math.max(0, 16 - Math.min(16, card.listRank));
  if (card.favoriteKey) score += favoriteDeskWeight(card.favoriteKey);
  return score;
}
function isGameWrap(card) {
  return isGameWrapStory(card);
}
function isHoldoverGame(card) {
  return Boolean(card.holdover && isGameWrap(card));
}
function ruleOrder(cards, edition) {
  return [...cards].sort((a, b) => {
    const byRank = storyRank(b, edition) - storyRank(a, edition);
    if (byRank) return byRank;
    const byList = (a.listRank ?? 99) - (b.listRank ?? 99);
    if (byList) return byList;
    return String(b.when ?? "").localeCompare(String(a.when ?? ""));
  });
}
function rankStories(cards, edition) {
  const ruled = ruleOrder(cards, edition);
  const slots = ruled.flatMap((card, i) => card.editorRank != null ? [i] : []);
  if (!slots.length) return ruled;
  const edited = slots.map((i) => ruled[i]).sort((a, b) => a.editorRank - b.editorRank);
  slots.forEach((slot, k) => {
    ruled[slot] = edited[k];
  });
  return ruled;
}
function stampCounts(pages) {
  const count = pages.length;
  return pages.map((page) => ({
    ...page,
    sectionCount: count
  }));
}
function storyBodyForJump(card) {
  const body = cleanStoryCopy(card.body).text;
  if (body.length >= 40) return body;
  const dek = cleanStoryCopy(card.dek).text;
  if (dek) return dek;
  return [card.scoreLine, card.headline].filter(Boolean).join(" ").trim();
}
function frontSplit(card, budget) {
  if (!card) return { teaser: "", rest: "" };
  const full = storyBodyForJump(card);
  if (!full) return { teaser: "", rest: "" };
  return splitStoryCopy(full, budget);
}
function uniqueCodes(ids) {
  const used = /* @__PURE__ */ new Set(["A", "B", "C"]);
  return ids.map((id) => {
    let code = id.code;
    if (used.has(code)) {
      let n = 2;
      while (used.has(`${id.code}${n}`)) n += 1;
      code = `${id.code}${n}`;
    }
    used.add(code);
    return { ...id, code };
  });
}
var FRONT_STORIES = 3;
var FRONT_BRIEFS = 4;
var FORM_CLUBS_PER_PAGE = 3;
function upcomingFor(clubs) {
  return clubs.flatMap(
    (club) => club.upcoming.map((game) => ({
      id: game.id,
      team: club.shortName,
      label: game.label,
      when: game.when,
      startIso: game.startIso ?? null,
      detail: game.detail
    }))
  );
}
function chunkClubs(clubs, size) {
  if (!clubs.length) return [];
  const out = [];
  for (let i = 0; i < clubs.length; i += size) out.push(clubs.slice(i, i + size));
  return out;
}
var WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
function weekdayName(day) {
  const d = /* @__PURE__ */ new Date(`${day.slice(0, 10)}T12:00:00Z`);
  return d.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }).toLowerCase();
}
function staleNamedPackage(card, edition) {
  const text = `${card.headline} ${card.dek ?? ""}`.toLowerCase();
  if (!/\b(takeaways|relive|wild-?card series|day \d+)\b/.test(text)) return false;
  const named = WEEKDAYS.filter((day) => new RegExp(`\\b${day}\\b`).test(text));
  if (!named.length) return false;
  const editionDay2 = edition.slice(0, 10);
  const allowed = /* @__PURE__ */ new Set([weekdayName(editionDay2), weekdayName(editionNewsDay(edition))]);
  return named.some((day) => !allowed.has(day));
}
function inEditionWindow(card, edition) {
  if (isEssentialsDesk(card)) return true;
  if (isGameWrap(card)) return gameWrapCovers(card.when, edition, card.leaguePath);
  if (card.holdover) return holdoverCovers(card.when, edition);
  return withinEditionHours(card.when, edition);
}
var HEAD_STOP = /* @__PURE__ */ new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "have",
  "has",
  "was",
  "were",
  "are",
  "but",
  "his",
  "her",
  "their",
  "its",
  "into",
  "over",
  "after",
  "before",
  "about",
  "will",
  "they",
  "them",
  "been",
  "than",
  "then",
  "when",
  "what",
  "your",
  "our",
  "who",
  "how",
  "not",
  "you",
  "all",
  "can",
  "just",
  "out",
  "new",
  "says",
  "said",
  "louis",
  "saint"
]);
function significantWords(headline) {
  return headline.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((word) => word.length > 3 && !HEAD_STOP.has(word));
}
function sameStory(a, b) {
  if (!a.length || !b.length) return false;
  const other = new Set(b);
  const shared = a.filter((word) => other.has(word));
  const shorter = Math.min(a.length, b.length);
  return shared.length >= 3 && shared.length / shorter >= 0.5;
}
function sourceRank(card) {
  const source = (storySource(card) ?? "").toLowerCase();
  if (source.includes("post-dispatch")) return 0;
  if (source.includes("athletic")) return 1;
  if (source.includes("associated press")) return 2;
  if (source === "espn") return 3;
  return 4;
}
function gameWrapRank(card) {
  if (card.wrapKind === "espn" || card.id.startsWith("wire-")) return 0;
  if (card.wrapKind === "box") return 2;
  if (isGameWrap(card)) return 3;
  if (isRecapStory(card)) return 4;
  return 5;
}
function sourceStoryId(card) {
  const prefixed = /^(?:news|league|espn)-(\d+)$/.exec(card.id);
  if (prefixed) return prefixed[1];
  const href = `${card.wrapHref ?? ""} ${card.gameHref ?? ""}`;
  return href.match(/\/(?:id|story)\/(\d{5,})/i)?.[1] ?? null;
}
var PATH_HINTS = [
  ["football/college-football", /\b(football|cfb|fbs|quarterback|touchdown|sec football|college football)\b/i],
  ["basketball/mens-college-basketball", /\b(basketball|hoops|cbb|ncaa tournament|march madness|tip-?off)\b/i],
  ["football/nfl", /\b(nfl|super bowl|draft)\b/i],
  ["baseball/mlb", /\b(mlb|world series|pitcher|home run)\b/i],
  ["hockey/nhl", /\b(nhl|hockey|stanley cup)\b/i],
  ["basketball/nba", /\b(nba|lakers|celtics)\b/i]
];
function sectionFitScore(card, path) {
  const hay2 = `${card.headline} ${card.dek ?? ""} ${card.body ?? ""}`;
  const hint = PATH_HINTS.find(([p]) => p === path)?.[1];
  let score = 0;
  if (card.leaguePath === path) score += 2;
  if (hint?.test(hay2)) score += 4;
  if (card.followed || card.favoriteKey) score += 3;
  return score;
}
function preferStory(next, prev) {
  const nextId = sourceStoryId(next);
  const prevId = sourceStoryId(prev);
  if (nextId && nextId === prevId && next.leaguePath !== prev.leaguePath) {
    const nextFit = sectionFitScore(next, next.leaguePath ?? "");
    const prevFit = sectionFitScore(prev, prev.leaguePath ?? "");
    if (nextFit !== prevFit) return nextFit > prevFit;
  }
  const nextWrap = gameWrapRank(next);
  const prevWrap = gameWrapRank(prev);
  if (nextWrap !== prevWrap && Math.min(nextWrap, prevWrap) <= 2) {
    return nextWrap < prevWrap;
  }
  if (isMainGameStory(next) && isMainGameStory(prev) && nextWrap !== prevWrap) {
    return nextWrap < prevWrap;
  }
  const rank = sourceRank(next) - sourceRank(prev);
  if (rank) return rank < 0;
  if ((next.followed || next.favoriteKey) !== (prev.followed || prev.favoriteKey)) {
    return Boolean(next.followed || next.favoriteKey);
  }
  return cleanStoryCopy(next.body).text.length > cleanStoryCopy(prev.body).text.length;
}
function storyUrlKey(card) {
  const raw = card.wrapHref || card.gameHref;
  if (!raw) return null;
  try {
    const u = new URL(raw);
    u.hash = "";
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid"].forEach(
      (k) => u.searchParams.delete(k)
    );
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "")}${u.search}`.toLowerCase();
  } catch {
    return raw.toLowerCase();
  }
}
function storyGameId(card) {
  const raw = card.gameId ?? "";
  const fromField = raw.match(/(\d{6,})/)?.[1] ?? (raw.length >= 4 ? raw : null);
  if (fromField) return fromField;
  const href = `${card.wrapHref ?? ""} ${card.gameHref ?? ""}`;
  const fromHref = href.match(/(?:gameId|event)[=/](\d{6,})/i)?.[1];
  if (fromHref) return fromHref;
  return /^(?:wire|recap|recent|wrap)[^\d]*(\d{6,})/.exec(card.id)?.[1] ?? null;
}
var TEAM_ALIASES = [
  ["cowboys", ["cowboys", "dallas"]],
  ["texans", ["texans", "houston"]],
  ["lions", ["lions", "detroit"]],
  ["panthers", ["panthers", "carolina"]],
  ["chiefs", ["chiefs"]],
  ["raiders", ["raiders", "vegas"]],
  ["blues", ["blues"]],
  ["avalanche", ["avalanche", "colorado"]],
  ["mizzou", ["mizzou", "missouri", "tigers"]],
  ["florida", ["florida", "gators"]]
];
var FAVORITE_TEAM = {
  "nfl-dal": "cowboys",
  "nfl-det": "lions",
  "nfl-kc": "chiefs",
  "nhl-stl": "blues",
  "cfb-mizzou": "mizzou",
  "mlb-stl": "cardinals"
};
function namedTeams(card) {
  const text = `${card.headline} ${card.dek ?? ""} ${card.teamName ?? ""}`.toLowerCase();
  const out = /* @__PURE__ */ new Set();
  const fav = card.favoriteKey ? FAVORITE_TEAM[card.favoriteKey] : null;
  if (fav) out.add(fav);
  for (const [canon, aliases] of TEAM_ALIASES) {
    if (aliases.some((alias) => new RegExp(`\\b${alias}\\b`, "i").test(text))) out.add(canon);
  }
  return out;
}
function shareMatchup(a, b) {
  const shared = [...namedTeams(a)].filter((team) => namedTeams(b).has(team));
  return shared.length >= 2;
}
function isGameRecapCopy(card) {
  if (isColumnStory(card) || isPreviewStory(card)) return false;
  const head = `${card.headline} ${card.dek ?? ""}`;
  if (/\bhow to bet\b|\bprop plays\b/i.test(head)) return false;
  if (isMultiGameRoundup(card)) return false;
  if (isMainGameStory(card)) return true;
  if (/\bgame highlights\b|\bfull highlights\b/i.test(head)) return true;
  if (/\btakeaways\b/i.test(head) && namedTeams(card).size >= 2) return true;
  if (/\b(?:win over|defeat(?:s|ed)?|trounc(?:es|ed)|beats?\b|rout(?:s|ed)?|crushed|whipped|edging|hold off|held off|thriller)\b/i.test(
    head
  )) {
    return true;
  }
  if (/\bvs\.?\b/i.test(head) && /\b(?:highlights|final|recap|score)\b/i.test(head)) return true;
  return /\b(?:go-ahead|touchdowns?|\btds?\b|catches?|\byards?\b)\b/i.test(head) && !/\binjur|dislocat|surgery|doubtful|questionable/i.test(head);
}
function isMultiGameRoundup(card) {
  const head = `${card.headline} ${card.dek ?? ""}`;
  if (/\bweek \d+\b/i.test(head) && /\b(takeaways|comebacks?|roundup|results|scores)\b/i.test(head) && !/\bvs\.?\b/i.test(head)) {
    return true;
  }
  return namedTeams(card).size >= 3;
}
function attachInferredGameIds(stories) {
  const byFav = /* @__PURE__ */ new Map();
  for (const card of stories) {
    if (!card.favoriteKey) continue;
    const gid = storyGameId(card);
    if (!gid) continue;
    if (!(isGameWrap(card) || card.status && /final/i.test(card.status))) continue;
    const set = byFav.get(card.favoriteKey) ?? /* @__PURE__ */ new Set();
    set.add(gid);
    byFav.set(card.favoriteKey, set);
  }
  return stories.map((card) => {
    if (storyGameId(card) || !card.favoriteKey || isColumnStory(card) || !isGameRecapCopy(card)) {
      return card;
    }
    const ids = byFav.get(card.favoriteKey);
    if (!ids || ids.size !== 1) return card;
    return { ...card, gameId: [...ids][0] };
  });
}
function isColumnStory(card) {
  const href = `${card.wrapHref ?? ""} ${card.feedUrl ?? ""}`;
  if (/\/(column|columns|opinion|commentary|editors-view)\b/i.test(href)) return true;
  if (/^(hochman|bernhard|goold|hummel|strauss|dunkley|caesar)\s*:/i.test(card.headline)) return true;
  return /\b(column|op-?ed|commentary)\b/i.test(card.headline);
}
function isMainGameStory(card) {
  if (isColumnStory(card)) return false;
  return isGameWrap(card) || isRecapStory(card);
}
function headlineTokens(card) {
  const aliases = {};
  if (card.favoriteKey === "cfb-mizzou") {
    aliases.mizzou = "missouri";
    aliases.tigers = "missouri";
    aliases.gators = "florida";
  }
  return significantWords(card.headline).map((word) => aliases[word] ?? word);
}
function sameSectionAStory(a, b) {
  if (a.id && a.id === b.id) return true;
  const urlA = storyUrlKey(a);
  const urlB = storyUrlKey(b);
  if (urlA && urlB && urlA === urlB) return true;
  const srcA = sourceStoryId(a);
  const srcB = sourceStoryId(b);
  if (srcA && srcB && srcA === srcB) return true;
  if (isColumnStory(a) || isColumnStory(b)) {
    return sameStory(headlineTokens(a), headlineTokens(b));
  }
  const gameA = storyGameId(a);
  const gameB = storyGameId(b);
  if (gameA && gameB && gameA === gameB) return true;
  if (isGameRecapCopy(a) && isGameRecapCopy(b) && shareMatchup(a, b)) return true;
  if (isMainGameStory(a) && isMainGameStory(b) && sameStory(headlineTokens(a), headlineTokens(b))) {
    return true;
  }
  return sameStory(headlineTokens(a), headlineTokens(b));
}
function pickBetterStory(cards) {
  return cards.reduce((best, card) => preferStory(card, best) ? card : best);
}
function dedupeStories(stories) {
  const stamped = attachInferredGameIds(stories);
  const groups = [];
  for (const card of stamped) {
    const hits = [];
    for (let i = 0; i < groups.length; i += 1) {
      if (groups[i].some((prev) => sameSectionAStory(card, prev))) hits.push(i);
    }
    if (!hits.length) {
      groups.push([card]);
      continue;
    }
    const [first, ...rest] = hits;
    groups[first].push(card);
    for (const i of rest.sort((a, b) => b - a)) {
      groups[first].push(...groups[i]);
      groups.splice(i, 1);
    }
  }
  return groups.map(pickBetterStory);
}
function isStalePreview(card, edition) {
  if (isRecapStory(card)) return false;
  const hay2 = `${card.headline} ${card.status ?? ""} ${card.dek ?? ""}`;
  if (!/\bpreview\b|\bbreak skid\b|\blook to\b|\binto game\b|\bprobable\b/i.test(hay2)) {
    return false;
  }
  return !withinEditionHours(card.when, edition);
}
var MAJOR_NEWS = new RegExp(
  [
    String.raw`no-?hitter`,
    String.raw`perfect game`,
    String.raw`clinch(?:es|ed|ing)?`,
    String.raw`eliminat(?:es|ed|ion)`,
    String.raw`(?:wins?|won|capture[sd]?|claims?) (?:the |a |its |their )?(?:world series|stanley cup|super bowl|pennant|national (?:championship|title)|(?:\w+ )?title)`,
    String.raw`champions?hip (?:game|series)? ?(?:win|victory)`,
    String.raw`(?:fire[sd]?|dismiss(?:es|ed)?|part(?:s|ed)? ways with|hire[sd]?|names?|named) (?:\S+ ){0,4}(?:manager|head coach|coach|general manager|gm|president|skipper)`,
    String.raw`steps? down`,
    String.raw`resign(?:s|ed)`,
    String.raw`traded`,
    String.raw`acquire[sd]`,
    String.raw`blockbuster`,
    String.raw`record (?:deal|contract)`,
    String.raw`season-ending`,
    String.raw`out for the season`,
    String.raw`torn (?:acl|achilles)`,
    String.raw`tommy john`,
    String.raw`suspend(?:s|ed)`,
    String.raw`banned`,
    String.raw`dies`,
    String.raw`died`,
    String.raw`death of`,
    String.raw`retires`,
    String.raw`announces? (?:his |her )?retirement`
  ].map((pattern) => String.raw`\b${pattern}\b`).join("|"),
  "i"
);
function isMajorStory(card) {
  if (isPreviewStory(card)) return false;
  const text = `${card.headline} ${card.dek ?? ""}`.replace(/\s+/g, " ");
  if (MAJOR_NEWS.test(text)) return true;
  return Boolean(
    card.postseason && isRecapStory(card) && /\b(?:advance[sd]?|sweep(?:s|ed)?|game (?:5|7)|series win|win (?:the )?series)\b/i.test(text)
  );
}
var LEAGUE_FRONT_MAX = FRONT_STORIES;
function editorFront(fresh) {
  let league = 0;
  const picked = [];
  const taken = /* @__PURE__ */ new Set();
  const ordered = fresh.filter((card) => card.editorFront != null && card.editorFront < FRONT_STORIES && hasStoryCopy(card)).filter((card) => !isHoldoverGame(card)).sort((a, b) => a.editorFront - b.editorFront);
  for (const card of ordered) {
    let choice = card;
    if (cannotLeadFront(card, fresh)) {
      choice = leadReplacement(card, fresh, taken);
      if (!choice) continue;
    }
    if (taken.has(choice.id)) continue;
    if (!(isFavoriteStory(choice) || choice.sportLabel === "Missouri" || isHistoricNationalCard(choice))) {
      if (choice.sportLabel === "National") continue;
      if (league >= LEAGUE_FRONT_MAX || !isMajorStory(choice)) continue;
      league += 1;
    }
    picked.push(choice);
    taken.add(choice.id);
    if (picked.length >= FRONT_STORIES) break;
  }
  return picked;
}
function favoritePages(freshStories, sectionStories, clubs, frontPicks = []) {
  const favoriteFolioByStory = {};
  const freshIds = new Set(freshStories.map((c) => c.id));
  const frontPool = [...freshStories, ...sectionStories.filter((c) => !freshIds.has(c.id))];
  const clubOf = (c) => c.favoriteKey ?? c.teamName ?? c.id;
  const picks = [];
  const taken = /* @__PURE__ */ new Set();
  for (const card of frontPicks) {
    if (picks.length >= FRONT_STORIES) break;
    let choice = card;
    if (cannotLeadFront(card, frontPool)) choice = leadReplacement(card, frontPool, taken);
    if (!choice || taken.has(choice.id) || cannotLeadFront(choice, frontPool)) continue;
    picks.push(choice);
    taken.add(choice.id);
  }
  const written = frontPool.filter(
    (c) => hasStoryCopy(c) && !cannotLeadFront(c, frontPool) && !taken.has(c.id)
  );
  for (const card of written) {
    if (picks.length >= 3) break;
    if (!picks.some((f) => clubOf(f) === clubOf(card))) {
      picks.push(card);
      taken.add(card.id);
    }
  }
  for (const card of [...written, ...frontPool]) {
    if (picks.length >= 3) break;
    if (cannotLeadFront(card, frontPool) || taken.has(card.id)) continue;
    picks.push(card);
    taken.add(card.id);
  }
  const [lead = null, second = null, third = null] = picks;
  for (const card of [lead, second, third]) {
    if (card) favoriteFolioByStory[card.id] = "A1";
  }
  const jumps = [];
  const jumpFolio = "A3";
  const maybeContinue = (card, budget) => {
    const { teaser, rest } = frontSplit(card, budget);
    if (!card || !rest) return { teaser: teaser || void 0 };
    jumps.push({ card, rest });
    favoriteFolioByStory[`${card.id}::cont`] = jumpFolio;
    return { folio: jumpFolio, teaser };
  };
  const leadJump = maybeContinue(lead, LEAD_TEASER);
  const secondJump = maybeContinue(second, SECOND_TEASER);
  const thirdJump = maybeContinue(third, THIRD_TEASER);
  const continues = jumps.length ? [
    {
      kind: "favorites-continue",
      folio: jumpFolio,
      section: "A",
      sectionTitle: SECTION_A_TITLE,
      sectionPage: 3,
      sectionCount: 0,
      continuedFrom: "A1",
      jumps,
      jumpFolio: void 0
    }
  ] : [];
  let n = 3 + continues.length;
  const inside = [];
  const frontIds = new Set(
    [lead, second, third].filter(Boolean).map((c) => c.id)
  );
  const restPool = [
    ...freshStories.filter((c) => !frontIds.has(c.id)),
    ...sectionStories.filter(
      (c) => !frontIds.has(c.id) && !freshStories.some((f) => f.id === c.id)
    )
  ];
  const full = restPool.filter(hasStoryCopy);
  const thin = restPool.filter((c) => !hasStoryCopy(c));
  let cursor = 0;
  let thinCursor = 0;
  while (cursor < full.length) {
    const primary = full[cursor];
    const secondary = full[cursor + 1];
    const last = cursor + 2 >= full.length;
    const take = last ? thin.length - thinCursor : FRONT_BRIEFS;
    const briefs = thin.slice(thinCursor, thinCursor + take);
    thinCursor += briefs.length;
    const folio = `A${n}`;
    favoriteFolioByStory[primary.id] = folio;
    if (secondary) favoriteFolioByStory[secondary.id] = folio;
    for (const brief of briefs) favoriteFolioByStory[brief.id] = folio;
    inside.push({
      kind: "favorites-inside",
      folio,
      section: "A",
      sectionTitle: SECTION_A_TITLE,
      sectionPage: n,
      sectionCount: 0,
      primary,
      secondary,
      briefs
    });
    cursor += 2;
    n += 1;
  }
  const front = {
    kind: "favorites-front",
    folio: "A1",
    section: "A",
    sectionTitle: SECTION_A_TITLE,
    sectionPage: 1,
    sectionCount: 0,
    lead,
    second,
    third,
    briefs: (freshStories.length ? freshStories : sectionStories).filter((c) => !frontIds.has(c.id)).slice(0, 6),
    news: freshStories.length ? freshStories : sectionStories,
    leadContinue: leadJump.folio,
    secondContinue: secondJump.folio,
    thirdContinue: thirdJump.folio,
    leadTeaser: leadJump.teaser,
    secondTeaser: secondJump.teaser,
    thirdTeaser: thirdJump.teaser
  };
  const clubsPage = {
    kind: "favorites-clubs",
    folio: "A2",
    section: "A",
    sectionTitle: SECTION_A_TITLE,
    sectionPage: 2,
    sectionCount: 0
  };
  const pages = [front, clubsPage, ...continues, ...inside];
  const orderedClubs = [...clubs].sort(
    (a, b) => favoriteDeskWeight(b.key) - favoriteDeskWeight(a.key)
  );
  const formChunks = chunkClubs(orderedClubs, FORM_CLUBS_PER_PAGE);
  let formIdx = 0;
  while (pages.length < MIN_SECTION_PAGES) {
    const chunk = formChunks[formIdx % Math.max(1, formChunks.length)] ?? orderedClubs.slice(0, FORM_CLUBS_PER_PAGE);
    const pageN = pages.length + 1;
    pages.push({
      kind: "favorites-form",
      folio: `A${pageN}`,
      section: "A",
      sectionTitle: SECTION_A_TITLE,
      sectionPage: pageN,
      sectionCount: 0,
      clubs: chunk.length ? chunk : orderedClubs
    });
    formIdx += 1;
    if (!orderedClubs.length && formIdx > MIN_SECTION_PAGES) break;
  }
  const watchN = pages.length + 1;
  pages.push({
    kind: "favorites-watch",
    folio: `A${watchN}`,
    section: "A",
    sectionTitle: SECTION_A_TITLE,
    sectionPage: watchN,
    sectionCount: 0
  });
  return {
    pages: stampCounts(pages),
    favoriteFolioByStory
  };
}
function sportSectionFocuses(opts) {
  const leaders = opts.withLeaders ? ["leaders"] : [];
  const players = opts.withPlayers ? ["players"] : [];
  const isMlb = opts.path === "baseball/mlb";
  if (opts.offseason) return ["front", "opener", "news", "teams", ...leaders, ...players];
  const reference = [];
  if (!opts.postseason) reference.push("teams");
  reference.push(isMlb ? "playoffs" : "form", ...leaders, "schedule", ...players);
  return ["front", "recaps", "news", ...reference];
}
function insertCoachesFocus(focuses, include) {
  if (!include || focuses.includes("coaches")) return focuses;
  const recapsAt = focuses.indexOf("recaps");
  if (recapsAt >= 0) {
    return [...focuses.slice(0, recapsAt + 1), "coaches", ...focuses.slice(recapsAt + 1)];
  }
  const refAt = focuses.findIndex((focus) => focus === "teams" || focus === "schedule");
  if (refAt >= 0) {
    return [...focuses.slice(0, refAt), "coaches", ...focuses.slice(refAt)];
  }
  return [...focuses, "coaches"];
}
function sportPages(id, clubs, stories, edition, withPlayers = false, offseason = false, withLeaders = false, postseason = false, withCoaches = false) {
  const upcoming = upcomingFor(clubs);
  const unique = dedupeStories(
    stories.filter(
      (card) => !isStalePreview(card, edition) && storyFitsSection(card, id.path) && (isGameWrap(card) || !isSportFiller(card))
    )
  );
  const desk = isDeskPress(edition);
  const NEWS_INSIDE_CAP = 6;
  const focuses = insertCoachesFocus(
    sportSectionFocuses({
      path: id.path,
      offseason,
      withLeaders,
      withPlayers,
      postseason
    }),
    withCoaches && printsFavoriteCoaches(edition)
  );
  const isStoryFocus = (f) => f === "front" || f === "recaps" || f === "news" || f === "opener";
  const storyFocuses = focuses.filter(isStoryFocus);
  const refFocuses = focuses.filter((f) => !isStoryFocus(f));
  const recapPool = orderSportRecaps(
    unique.filter((card) => isGameWrap(card) || isRecapStory(card)),
    id.path
  );
  const newsPool = unique.filter((card) => !isGameWrap(card) && !isSportFiller(card, recapPool)).slice(0, SPORT_NEWS_CAP);
  const frontPool = orderSportSectionFront([...recapPool, ...newsPool], id.path, edition);
  const inside = [];
  const full = desk ? [] : [
    ...recapPool.filter(hasStoryCopy),
    ...newsPool.filter(hasStoryCopy).slice(0, NEWS_INSIDE_CAP)
  ];
  for (let i = 0; i < full.length; i += 2) {
    const primary = full[i];
    const secondary = full[i + 1];
    inside.push({
      kind: "sport-inside",
      folio: "",
      section: id.code,
      sectionTitle: id.title,
      sectionPage: 0,
      sectionCount: 0,
      path: id.path,
      primary,
      secondary
    });
  }
  const raw = [
    ...storyFocuses.map((focus) => ({
      section: id.code,
      sectionTitle: id.title,
      sectionCount: 0,
      path: id.path,
      clubs,
      upcoming,
      kind: "sport-front",
      folio: "",
      sectionPage: 0,
      focus,
      offseason,
      turn: null,
      articles: []
    })),
    ...inside,
    ...refFocuses.map((focus) => ({
      section: id.code,
      sectionTitle: id.title,
      sectionCount: 0,
      path: id.path,
      clubs,
      upcoming,
      kind: "sport-front",
      folio: "",
      sectionPage: 0,
      focus,
      offseason,
      turn: null,
      articles: []
    }))
  ];
  const numbered = raw.map((page, i) => ({
    ...page,
    folio: `${id.code}${i + 1}`,
    sectionPage: i + 1
  }));
  const sportFolioByStory = {};
  for (const page of numbered) {
    if (page.kind !== "sport-inside") continue;
    sportFolioByStory[page.primary.id] = page.folio;
    if (page.secondary) sportFolioByStory[page.secondary.id] = page.folio;
  }
  const sectionDesks = numbered.flatMap(
    (page) => page.kind === "sport-front" ? [{ focus: page.focus, folio: page.folio }] : []
  );
  const fallbackDesk = (focus) => sectionDesks.find((d) => d.focus === focus)?.folio ?? `${id.code}1`;
  const articlesFor = (focus, cards) => cards.map((card) => ({
    card,
    folio: sportFolioByStory[card.id] ?? fallbackDesk(focus)
  }));
  const pages = numbered.map((page, i) => {
    if (page.kind !== "sport-front") return page;
    const nextFront = numbered.slice(i + 1).find((p) => p.kind === "sport-front");
    const pool = page.focus === "front" ? frontPool : page.focus === "news" ? newsPool : page.focus === "recaps" ? recapPool : unique;
    return {
      ...page,
      sectionDesks,
      turn: nextFront && nextFront.kind === "sport-front" ? { folio: nextFront.folio, focus: nextFront.focus } : null,
      articles: articlesFor(page.focus, pool)
    };
  });
  return {
    pages: stampCounts(pages),
    sportFolioByStory
  };
}
var MO_FRONT = 11;
var MO_PAGE = 16;
function missouriPages(desk, code = "B") {
  if (!desk?.items.length) return [];
  const clean = desk.items.filter((item) => !isPromoMissouriItem(item));
  if (!clean.length) return [];
  const chunks = [clean.slice(0, MO_FRONT)];
  for (let i = MO_FRONT; i < clean.length && chunks.length < 3; i += MO_PAGE) {
    chunks.push(clean.slice(i, i + MO_PAGE));
  }
  return stampCounts(
    chunks.map((items, i) => ({
      kind: "missouri",
      folio: `${code}${i + 1}`,
      section: code,
      sectionTitle: "Missouri",
      sectionPage: i + 1,
      sectionCount: 0,
      items,
      listen: i === 0 ? desk.listen : []
    }))
  );
}
function nationalPages(desk) {
  if (!desk?.stories.length) return [];
  const packed = packNationalPages(desk.stories);
  return stampCounts(
    packed.map((page, i) => ({
      kind: "national",
      folio: `B${i + 1}`,
      section: "B",
      sectionTitle: "National News",
      sectionPage: i + 1,
      sectionCount: 0,
      stories: page.stories,
      startIndex: 0,
      editionLabel: desk.label,
      day: desk.day,
      jumpFolio: packed[i + 1] ? `B${i + 2}` : void 0
    }))
  );
}
function deskCopy(stories, edition) {
  const inWindow = stories.filter(
    (card) => isDeskStory(card) && !isNewsMuted(card) && !staleNamedPackage(card, edition) && inEditionWindow(card, edition)
  );
  return dedupeStories(inWindow);
}
function buildEdition(opts) {
  const fresh = rankStories(
    deskCopy(opts.stories, opts.edition).filter((card) => !card.editorSpiked),
    opts.edition
  );
  const favoriteFresh = fresh.filter(isSectionAStory);
  const paths = /* @__PURE__ */ new Set();
  for (const club of opts.clubs) if (club.leaguePath) paths.add(club.leaguePath);
  for (const story of fresh) if (story.leaguePath) paths.add(story.leaguePath);
  const ids = uniqueCodes(orderSportSections([...paths].map(sportSectionId), opts.edition));
  const clubsBy = /* @__PURE__ */ new Map();
  for (const club of opts.clubs) {
    if (!club.leaguePath) continue;
    const list = clubsBy.get(club.leaguePath) ?? [];
    list.push(club);
    clubsBy.set(club.leaguePath, list);
  }
  const storiesBy = /* @__PURE__ */ new Map();
  for (const story of fresh) {
    if (!story.leaguePath) continue;
    if (favoriteFresh.some((a) => a.id === story.id || sameSectionAStory(a, story))) continue;
    const list = storiesBy.get(story.leaguePath) ?? [];
    list.push(story);
    storiesBy.set(story.leaguePath, list);
  }
  const sportPagesBuilt = ids.map((id) => ({
    id,
    built: sportPages(
      id,
      clubsBy.get(id.path) ?? [],
      storiesBy.get(id.path) ?? [],
      opts.edition,
      opts.playerPaths?.includes(id.path) ?? false,
      opts.offseason?.includes(id.path) ?? false,
      opts.leaderPaths?.includes(id.path) ?? false,
      opts.postseasonPaths?.includes(id.path) ?? false,
      opts.coachPaths?.includes(id.path) ?? false
    )
  }));
  const sportFolioByStory = {};
  for (const part of sportPagesBuilt) Object.assign(sportFolioByStory, part.built.sportFolioByStory);
  const favorites = favoritePages(favoriteFresh, favoriteFresh, opts.clubs, editorFront(fresh));
  const national = nationalPages(opts.national ?? null);
  const mo = missouriPages(opts.missouri ?? null, national.length ? "C" : "B");
  const pages = [...favorites.pages, ...national, ...mo];
  const sections = [
    {
      code: "A",
      title: SECTION_A_TITLE,
      folio: "A1",
      index: 0,
      stories: favoriteFresh.length,
      upcoming: opts.clubs.reduce((n, club) => n + Math.min(1, club.upcoming.length), 0),
      pages: favorites.pages.length
    }
  ];
  if (national.length) {
    sections.push({
      code: "B",
      title: "National News",
      folio: "B1",
      index: favorites.pages.length,
      stories: national.reduce((n, p) => n + p.stories.length, 0),
      upcoming: 0,
      pages: national.length
    });
  }
  if (mo.length) {
    const moCode = national.length ? "C" : "B";
    sections.push({
      code: moCode,
      title: "Missouri",
      folio: `${moCode}1`,
      index: favorites.pages.length + national.length,
      stories: mo.reduce((n, p) => n + p.items.length, 0),
      upcoming: 0,
      pages: mo.length
    });
  }
  for (const part of sportPagesBuilt) {
    const upcoming = (clubsBy.get(part.id.path) ?? []).reduce((n, club) => n + club.upcoming.length, 0);
    sections.push({
      code: part.id.code,
      title: part.id.title,
      folio: `${part.id.code}1`,
      index: pages.length,
      stories: (storiesBy.get(part.id.path) ?? []).length,
      upcoming,
      pages: part.built.pages.length
    });
    pages.push(...part.built.pages);
  }
  return {
    pages,
    sections,
    sportFolioByStory,
    favoriteFolioByStory: favorites.favoriteFolioByStory
  };
}

// src/lib/times-telegram-entry.ts
function slim(card) {
  const headline = String(card?.headline ?? "").replace(/\s+/g, " ").trim();
  if (!card || !headline) return null;
  return { id: card.id, headline, teamName: card.teamName ?? null };
}
function frontStories(stories, edition) {
  const paper = buildEdition({ stories, clubs: [], edition });
  const front = paper.pages.find((p) => p.kind === "favorites-front");
  if (!front) return [];
  return [front.lead, front.second, front.third].map(slim).filter((s) => Boolean(s));
}
export {
  frontStories
};
