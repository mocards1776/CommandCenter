
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
  return /^(?:wire|recap|recent|wrap|box)-/.test(card.id);
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
  if (leaguePath === "football/nfl" && (wd === 1 || wd === 2)) {
    return pressInstant(`${shiftDay(day, wd === 1 ? -2 : -3)}-morning`);
  }
  if (wd === 1) return pressInstant(`${shiftDay(day, -2)}-morning`);
  if (slot !== "morning") return pressInstant(`${shiftDay(day, -1)}-morning`);
  return pressInstant(`${shiftDay(day, -1)}-morning`);
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
  return /\bin (?:a |the )?(?:win|loss|defeat)\b/.test(hay2) || /\bwin (?:over|vs\.?|against)\b/.test(hay2) || /\b(?:beat|beats|defeated|edged|routed|routs|downed|topped|trounced|trounces|blanked|pounded|thrashed|clobbered)\b/.test(
    hay2
  ) || /\b(?:lifts|lifted)\b[^.]{0,48}\b(?:win|victory|over)\b/.test(hay2) || /\bwalk-?off\b/.test(hay2) || /\bposts? \d+ points\b/.test(hay2) || /\brecaps?\b/.test(hay2) || /\b\d{1,3}\s*[-–]\s*\d{1,3}\s+(?:win|loss|victory|defeat)\b/.test(hay2) || /\b\d{1,3}\s*[-–]\s*\d{1,3}\b/.test(hay2);
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
  if (key === "nfl-dal") return 45;
  if (key === "cfb-missouri-state" || key === "cbb-missouri-state") return 40;
  if (key === "eng-arsenal" || key === "eng-wrexham" || key === "eng-wolves") return 25;
  if (key.startsWith("eng-") || key.includes("soccer")) return 20;
  if (key === "nba-phi") return 8;
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
function isTeamNameCaption(text) {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return true;
  if (/[.!?,:;]/.test(t)) return false;
  const words = t.split(" ");
  if (words.length > 4) return false;
  return /^(the\s+)?[A-Za-z.]+(?:\s+[A-Za-z.]+){0,3}$/.test(t);
}
function stripGettyCredit(text) {
  return text.replace(/\s*\((?:Getty(?:\s+Images)?|getty images)\)/gi, "").replace(/^\s*(?:Getty(?:\s+Images)?)\s*$/i, "").replace(/\s{2,}/g, " ").trim();
}
var BOILERPLATE_LINE = /^(?:-{3,}|_{3,}|\*{3,}|sign up for\b|subscribe:|jump to:|posted in\b|share this:|to read this\b|click here\b|download the app\b|follow us on\b|read more\b|advertisement\b|related stories\b|you may also like\b|watch:|terms of use\b|privacy policy\b|privacy notice\b|cookie (?:policy|settings)\b)/i;
var BOILERPLATE_GETTY = /^\(?getty(?:\s+images)?\)?\.?$/i;
var GAMBLING_LINE = /\b(?:1-800-gambler|1-800-522-4700|1-800-next-step|1-800-9-with-it|1-800-betsoff|gambling problem|gambling helpline|responsible gaming|draftkings|fanduel|betmgm|caesars sportsbook|if you or someone you know has a gambling|must be 21(?:\+| years)|gamblinghelp|visitgambling|ncpgambling|rg-help)\b/i;
var LEGAL_LINE = /\b(?:terms of use|privacy policy|privacy notice|cookie policy|all rights reserved|©\s*\d{4}|copyright\s*©|void where prohibited)\b/i;
var RELATED_LINE = /^(?:watch:|read more\b|related(?: stories| links)?:|more from\b|also on espn\b|click for (?:full )?story\b)/i;
var VIDEO_STAMP = /\b\d{1,2}:\d{2}\b/;
function isBoilerplateLine(line) {
  const t = line.replace(/\s+/g, " ").trim();
  if (!t) return true;
  if (BOILERPLATE_GETTY.test(t)) return true;
  if (BOILERPLATE_LINE.test(t)) return true;
  if (GAMBLING_LINE.test(t)) return true;
  if (LEGAL_LINE.test(t) && t.length < 280) return true;
  if (RELATED_LINE.test(t)) return true;
  if (/^sign up for\b/i.test(t) && /\balerts?\b/i.test(t)) return true;
  if (isCaptionOnlyLine(t)) return true;
  if (isVideoTitleLine(t)) return true;
  return false;
}
function isCaptionOnlyLine(line) {
  const t = line.replace(/\s+/g, " ").trim();
  if (!t) return true;
  if (isTeamNameCaption(t)) return true;
  if (/^(?:photo|image|courtesy|ap photo|getty)\b/i.test(t) && t.length < 80) return true;
  if (/:\s*(?:game |full )?highlights\s*$/i.test(t) && t.length < 140) return true;
  return false;
}
function isVideoTitleLine(line) {
  const t = line.replace(/\s+/g, " ").trim();
  if (!t) return true;
  if (/^watch:/i.test(t)) return true;
  if (VIDEO_STAMP.test(t) && t.length < 160 && !/[.!]/.test(t.replace(VIDEO_STAMP, ""))) return true;
  if (/^(?:did|is|are|can|will|why|how|what)\b.+\?$/i.test(t) && t.length < 140) return true;
  return false;
}
function isVideoTitleSoup(text) {
  const raw = text.replace(/\s+/g, " ").trim();
  if (raw.length < 40) return false;
  if (/\bwatch:\b/i.test(raw) && VIDEO_STAMP.test(raw)) return true;
  if (/(.{18,90})\s+\1/i.test(raw) && VIDEO_STAMP.test(raw)) return true;
  if (/(.{18,90})\s+\1/i.test(raw) && /\b(?:film room|must-see|highlights?)\b/i.test(raw)) return true;
  const questions = (raw.match(/\?/g) ?? []).length;
  const sentences = (raw.match(/[.!](?=\s|$)/g) ?? []).length;
  if (questions >= 2 && sentences < 2 && VIDEO_STAMP.test(raw)) return true;
  const stamps = raw.match(/\b\d{1,2}:\d{2}\b/g)?.length ?? 0;
  return stamps >= 2 && raw.length < 900;
}
function isGamblingDisclaimer(text) {
  return GAMBLING_LINE.test(text);
}
function stripBoilerplateCopy(text) {
  return text.split(/\n{2,}|\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter((line) => !isBoilerplateLine(line)).join("\n\n").trim();
}
var INLINE_JUNK_CUT = /\b(?:terms of use|privacy policy|privacy notice|cookie policy|all rights reserved|©\s*\d{4}|1-800-gambler|gambling problem|responsible gaming|must be 21(?:\+| years)|visitgambling|ncpgambling|watch:\s*)/i;
function sanitizeArticleBody(text) {
  let raw = text ?? "";
  if (!raw.trim()) return "";
  if (looksLikeHtml(raw)) raw = htmlToNewspaperText(raw);
  else raw = decodeNewspaperEntities(raw);
  raw = stripBoilerplateCopy(raw);
  raw = raw.replace(/\bWatch:\s*[^.!?\n]{0,160}/gi, " ").replace(/\bRead more\b[:\s][^.!?\n]{0,160}/gi, " ").replace(/\b(?:Terms of Use|Privacy Policy|Cookie Policy)\b/gi, " ");
  const paras = raw.split(/\n{2,}/).map((p) => tidy(p.replace(/\s+/g, " "))).filter((p) => p && !isBoilerplateLine(p) && !isGamblingDisclaimer(p));
  let out = paras.join("\n\n").trim();
  const cut = out.search(INLINE_JUNK_CUT);
  if (cut >= 40) out = out.slice(0, cut).trim();
  else if (cut >= 0 && cut < 40) out = "";
  out = collapseInline(out);
  if (!out || isNavSoup(out) || isVideoTitleSoup(out)) return "";
  return out;
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
function restorePossessiveSpace(text) {
  return text.replace(/(\w)['‘]/g, "$1\u2019").replace(/(\p{L}|\d)(['’])(?!(?:s|t|ll|re|ve|d|m)\b)(\p{L})/gu, "$1$2 $3").replace(/(\p{L})(['’])(\d)/gu, "$1$2 $3");
}
function printHeadline(text) {
  return restorePossessiveSpace(String(text ?? "").replace(/\s+/g, " ").trim());
}
function tidy(text) {
  return restorePossessiveSpace(
    joinBrokenDecimals(
      decodeNewspaperEntities(stripGettyCredit(text)).replace(/\s+([,;:!?])/g, "$1").replace(/\s+\.(?!\d)/g, ".").replace(/(\w)\s+([’‘'`])/g, "$1$2").replace(/(?<!\w)([‘'])\s+(\w)/g, "$1$2").replace(/(["“])\s+/g, "$1").replace(/\s+(["”])/g, "$1").replace(/([,;:.!?])(["“])(?=\S)/g, "$1 $2").replace(/\s*(?:--|—|–)[\s—–-]+/g, " \u2014 ").replace(/\(\s+/g, "(").replace(/\s+\)/g, ")")
    ).replace(/[^\S\n]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim()
  );
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
  return sanitizeArticleBody(text);
}
function cleanedBodyLength(card) {
  if (typeof card.bodyChars === "number") return card.bodyChars;
  return cleanStoryCopy(card.body).text.length;
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

// src/lib/newspaper-favorite-match.ts
var WEAK_TOKENS = /* @__PURE__ */ new Set([
  "the",
  "and",
  "st.",
  "st",
  "fc",
  "afc",
  "club",
  "city",
  "united",
  "state",
  "states",
  "football",
  "basketball",
  "baseball",
  "hockey",
  "soccer",
  "tour",
  "louis",
  "kansas",
  "detroit",
  "missouri"
]);
function strongNames(fav) {
  const names = [fav.shortName, fav.name].map((n) => n.trim().toLowerCase()).filter(Boolean);
  if (fav.key === "mlb-stl") names.push("cardinals", "st. louis cardinals", "stl");
  if (fav.key === "nfl-kc") names.push("chiefs", "kansas city chiefs", "kc");
  if (fav.key === "nfl-det") names.push("lions", "detroit lions");
  if (fav.key === "cfb-mizzou" || fav.key === "cbb-mizzou") {
    names.push("mizzou", "missouri tigers");
  }
  if (fav.key === "cfb-missouri-state" || fav.key === "cbb-missouri-state") {
    names.push("missouri state");
  }
  if (fav.key === "eng-wolves") names.push("wolves", "wolverhampton", "wolverhampton wanderers");
  if (fav.key === "eng-wrexham") names.push("wrexham");
  if (fav.key === "eng-arsenal") names.push("arsenal");
  if (fav.key === "nhl-stl") names.push("blues", "st. louis blues");
  if (fav.key === "nfl-dal") names.push("cowboys", "dallas cowboys");
  if (fav.key === "nba-phi") names.push("76ers", "sixers", "philadelphia 76ers");
  return [...new Set(names)].filter((n) => n.length >= 3 && !WEAK_TOKENS.has(n));
}
var AMBIGUOUS_NICK = /^(cardinals|lions|bears|blues|wolves|arsenal)$/i;
var FAVORITE_CONFLICTS = {
  "mlb-stl": /\barizona\b|\bari\b|\bnfl\b|\bgiants['’]?\s+36-24\b/i,
  "nhl-stl": /\bchelsea\b|\bst\.?\s*louis city\b/i,
  "nfl-det": /\bnittany\b|\bpenn\s*state\b|\bcolumbia lions\b/i,
  "eng-wolves": /\btimberwolves?\b|\bminnesota\b|\bnba\b/i,
  "eng-arsenal": /\barsenal\s+(?:shirt|jacket|fc\s+women)\b/i,
  "cfb-missouri-state": /\bchicago\b|\bcal(?:ifornia)?\b|\bbaylor\b|\bpackers\b/i,
  "cbb-missouri-state": /\bchicago\b|\bcal(?:ifornia)?\b|\bbaylor\b/i
};
var KNOWN_ESPN_TEAM_ID = {
  "mlb-stl": "24",
  "nhl-stl": "19",
  "cfb-mizzou": "142",
  "cbb-mizzou": "142",
  "cfb-missouri-state": "2623",
  "cbb-missouri-state": "2623",
  "nfl-det": "8",
  "nfl-kc": "12",
  "nfl-dal": "6",
  "nba-phi": "20",
  "eng-wrexham": "352",
  "eng-wolves": "380",
  "eng-arsenal": "359"
};
function favoriteEspnTeamId(fav) {
  const id = fav.espnPath.split("/").pop();
  if (id && /^\d+$/.test(id) && id !== "0") return id;
  return KNOWN_ESPN_TEAM_ID[fav.key] ?? null;
}
function favoriteAbbrevs(fav) {
  if (fav.key === "mlb-stl" || fav.key === "nhl-stl") return ["stl"];
  if (fav.key === "nfl-kc") return ["kc"];
  if (fav.key === "nfl-det") return ["det"];
  if (fav.key === "nfl-dal") return ["dal"];
  if (fav.key === "nba-phi") return ["phi"];
  if (fav.key === "eng-wolves") return ["wol"];
  if (fav.key === "eng-wrexham") return ["wrx"];
  if (fav.key === "eng-arsenal") return ["ars"];
  if (fav.key === "cfb-mizzou" || fav.key === "cbb-mizzou") return ["miz"];
  if (fav.key === "cfb-missouri-state" || fav.key === "cbb-missouri-state") return ["most"];
  return [];
}
function cardLeaguePathOf(card) {
  if (card.leaguePath) return card.leaguePath.toLowerCase();
  const s = (card.sportLabel ?? "").trim().toLowerCase();
  if (s === "nfl" || s === "football") return "football/nfl";
  if (s === "mlb" || s === "baseball") return "baseball/mlb";
  if (s === "nhl" || s === "hockey") return "hockey/nhl";
  if (s === "nba" || s === "basketball") return "basketball/nba";
  if (s === "cfb" || s === "college football") return "football/college-football";
  if (s === "cbb" || s === "college basketball" || s === "ncaam") return "basketball/mens-college-basketball";
  if (s === "epl" || s === "premier league") return "soccer/eng.1";
  if (s === "efl" || s === "championship") return "soccer/eng.2";
  return null;
}
function favoriteKeyFitsPath(key, leaguePath, sportLabel) {
  if (!key) return false;
  const path = (leaguePath || cardLeaguePathOf({ leaguePath: null, sportLabel }) || "").toLowerCase();
  if (!path) return true;
  const prefix = key.split("-")[0];
  switch (prefix) {
    case "mlb":
      return path === "baseball/mlb";
    case "nfl":
      return path === "football/nfl";
    case "nhl":
      return path === "hockey/nhl";
    case "nba":
      return path === "basketball/nba";
    case "cfb":
      return path === "football/college-football";
    case "cbb":
      return path === "basketball/mens-college-basketball";
    case "eng":
      return path.startsWith("soccer/");
    default:
      return true;
  }
}
function collectCardTeamIds(card) {
  const ids = [];
  for (const side of [card.recapGame?.away, card.recapGame?.home]) {
    if (side?.id) ids.push(String(side.id));
  }
  return ids;
}
function collectCardAbbrevs(card) {
  const out = [];
  for (const side of [card.recapGame?.away, card.recapGame?.home]) {
    if (side?.abbrev) out.push(side.abbrev.toLowerCase());
  }
  return out;
}
var HAY_NAME_RE = /* @__PURE__ */ new Map();
function hayHasName(hay2, name) {
  if (!name) return false;
  let re = HAY_NAME_RE.get(name);
  if (!re) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    re = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`, "i");
    HAY_NAME_RE.set(name, re);
  }
  return re.test(hay2);
}
function storyMatchesFavorite(card, fav) {
  if (fav.kind !== "team") return false;
  const path = cardLeaguePathOf(card);
  if (path && !favoriteKeyFitsPath(fav.key, path, card.sportLabel)) return false;
  const favId = favoriteEspnTeamId(fav);
  const ids = collectCardTeamIds(card);
  if (favId && ids.includes(favId)) return true;
  if (fav.mlbTeamId && ids.includes(String(fav.mlbTeamId))) return true;
  const abbrevs = favoriteAbbrevs(fav);
  const cardAbbrevs = collectCardAbbrevs(card);
  if (abbrevs.some((a) => cardAbbrevs.includes(a))) return true;
  const hay2 = `${card.headline ?? ""} ${card.dek ?? ""} ${card.teamName ?? ""}`.toLowerCase();
  const conflict = FAVORITE_CONFLICTS[fav.key];
  if (conflict?.test(hay2)) return false;
  const official = (fav.name || "").trim().toLowerCase();
  if (official.length >= 6 && hayHasName(hay2, official)) return true;
  if ((fav.key === "cfb-mizzou" || fav.key === "cbb-mizzou") && /\bmissouri\b(?!\s+state)/i.test(hay2)) {
    return true;
  }
  if (abbrevs.some((a) => hayHasName(hay2, a))) {
    if (!path || favoriteKeyFitsPath(fav.key, path, card.sportLabel)) return true;
  }
  const names = strongNames(fav);
  const nickHit = names.some((n) => hayHasName(hay2, n));
  if (!nickHit) return false;
  if (path && favoriteKeyFitsPath(fav.key, path, card.sportLabel)) {
    const nick = (fav.shortName || "").trim().toLowerCase();
    if (AMBIGUOUS_NICK.test(nick) && hayHasName(hay2, nick) && !hayHasName(hay2, official) && !abbrevs.some((a) => hayHasName(hay2, a))) {
      if (fav.key === "mlb-stl" || fav.key === "nhl-stl") return hayHasName(hay2, "st. louis") || hayHasName(hay2, "stl");
      if (fav.key === "nfl-det") return hayHasName(hay2, "detroit") || hayHasName(hay2, "det");
      if (fav.key === "eng-wolves") return hayHasName(hay2, "wolverhampton") || hayHasName(hay2, "wol");
    }
    return true;
  }
  const long = names.filter((n) => n.length >= 8 && !AMBIGUOUS_NICK.test(n));
  return hayHasName(hay2, official) || long.some((n) => hayHasName(hay2, n));
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
function scoresInHeadline(headline) {
  const hit = headline.match(/(\d+)\s*[-–to]+\s*(\d+)/i);
  if (!hit) return null;
  return [Number(hit[1]), Number(hit[2])];
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
function isInjuryNote(card) {
  if (isGameWrapCard(card)) return false;
  if (card.scoreLine && /\d/.test(card.scoreLine) && /\bfinal\b/i.test(card.status ?? "")) return false;
  const head = `${card.headline} ${card.dek ?? ""}`;
  return /\binjur|surgery|questionable|doubtful|out for the season|season-ending|torn (?:acl|achilles)|dislocat|to have surgery|expected back in|out \d+(?:-\d+)? weeks|sidelined|injured reserve|week-to-week|placed on ir\b/i.test(
    head
  );
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
var EFL_CLUB = /\b(wrexham|wolves|wolverhampton|leicester|southampton|ipswich|leeds|norwich|sheffield wednesday|sheffield united|west brom|coventry|middlesbrough|stoke|hull|bristol city|watford|swansea|cardiff|qpr|queens park|millwall|preston|blackburn|derby|portsmouth|oxford|plymouth|charlton|birmingham|sunderland|championship|efl)\b/i;
var NOT_EFL = /\b(messi|ronaldo|reyna|inter miami|mls|lafc|galaxy|premier league|champions league|liga mx)\b/i;
function isEflChampionshipStory(card) {
  if (card.leaguePath && card.leaguePath !== "soccer/eng.2") return false;
  const text = hay(card);
  if (NOT_EFL.test(text) && !EFL_CLUB.test(text)) return false;
  return EFL_CLUB.test(text);
}
var CFB_OFF_DESK = /\b(colts|commanders|jordan walker|nfl\b|world series|nlcs|alcs)\b/i;
var CFB_OTHER_SPORT = /\b(soccer|usmnt|world cup|\bmls\b|premier league|nba\b|nhl\b|wizards|anthony davis|timberwolves|lakers)\b/i;
var CFB_SIGNAL = /\b(college|ncaa|sec\b|acc\b|big ten|big 12|mizzou|missouri tigers)\b/i;
function cfbDeskCopy(text) {
  if (CFB_OTHER_SPORT.test(text)) return false;
  if (CFB_OFF_DESK.test(text) && !CFB_SIGNAL.test(text)) return false;
  return true;
}
function storyFitsSection(card, path) {
  if (path === "soccer/eng.2") return isEflChampionshipStory(card);
  if (card.leaguePath && card.leaguePath !== path) return false;
  if (path === "football/college-football") {
    const text = hay(card);
    if (!cfbDeskCopy(text)) return false;
    if (!card.leaguePath && /\b(nfl|mlb|nhl|nba)\b/i.test(text) && !CFB_SIGNAL.test(text)) return false;
  }
  return !card.leaguePath || card.leaguePath === path;
}
function eventIdOf(card) {
  const raw = card.gameId ?? "";
  const fromId = raw.match(/(\d{6,})/)?.[1];
  if (fromId) return fromId;
  const href = `${card.wrapHref ?? ""} ${card.gameHref ?? ""}`;
  return href.match(/(?:gameId|event)[=/](\d{6,})/i)?.[1] ?? null;
}
var GAME_TOKEN_STOP = /* @__PURE__ */ new Set([
  "beat",
  "over",
  "from",
  "with",
  "that",
  "will",
  "this",
  "have",
  "been",
  "were",
  "they",
  "into",
  "after",
  "week",
  "more",
  "than",
  "then",
  "when",
  "game",
  "win",
  "wins",
  "lead",
  "seals",
  "throws",
  "passes",
  "start",
  "best",
  "fuel"
]);
function teamTokens(card) {
  return `${card.headline} ${card.scoreLine ?? ""} ${card.teamName}`.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length >= 4 && !GAME_TOKEN_STOP.has(w));
}
var matchKeyCache = /* @__PURE__ */ new WeakMap();
function matchKeyOf(card) {
  const hit = matchKeyCache.get(card);
  if (hit) return hit;
  const tokens = teamTokens(card);
  const key = {
    eventId: eventIdOf(card),
    tokens,
    tokenSet: new Set(tokens),
    scoreKey: card.scoreLine ? `${card.scoreLine}\0${card.leaguePath ?? ""}` : null,
    leaguePath: card.leaguePath ?? null,
    hasScore: Boolean(card.scoreLine),
    isWrap: isGameWrapCard(card)
  };
  matchKeyCache.set(card, key);
  return key;
}
function sameGameKeyed(a, b) {
  if (a.eventId && b.eventId && a.eventId === b.eventId) return true;
  if (a.leaguePath && b.leaguePath && a.leaguePath !== b.leaguePath) return false;
  if (a.scoreKey && b.scoreKey && a.scoreKey === b.scoreKey) return true;
  const shared = b.tokens.filter((w) => a.tokenSet.has(w));
  return shared.length >= 2 && Boolean(a.hasScore || b.hasScore || a.isWrap || b.isWrap);
}
function sameGameStory(a, b) {
  return sameGameKeyed(matchKeyOf(a), matchKeyOf(b));
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
function isBoxStub(card) {
  if (card.wrapKind === "box") return true;
  if (card.id.startsWith("box-") && !card.photo && (card.body?.length ?? 0) < 400) return true;
  return false;
}
function isWrapLead(card) {
  if (isGameWrapCard(card) || Boolean(card.scoreLine && /\d/.test(card.scoreLine))) return true;
  if (scoresInHeadline(card.headline ?? "")) return true;
  return isResultCopy({
    headline: card.headline,
    dek: card.dek,
    status: card.status,
    scoreLine: card.scoreLine,
    type: card.id.startsWith("news-") || card.id.startsWith("league-") ? card.status : null
  });
}
function isStoryPhoto(url) {
  if (!url) return false;
  return !/teamlogos|\/team-logos\/|\/logos\//i.test(url);
}
function alreadyOnSectionA(card, ran = []) {
  return ran.some((a) => a.id === card.id || sameGameStory(a, card));
}
function pickSectionFrontLead(wraps, pool, editorLead, newsLead, alreadyOnA1 = []) {
  const open = (cs) => cs.filter((c) => !alreadyOnSectionA(c, alreadyOnA1));
  const quality = wraps.filter((c) => !isBoxStub(c) && (isStoryPhoto(c.photo) || (c.body?.length ?? 0) >= 280));
  const pictured = quality.filter((c) => isStoryPhoto(c.photo));
  const picturedFresh = pictured.filter((c) => !c.holdover);
  const picturedPost = pictured.filter((c) => c.postseason);
  const qualityFresh = quality.filter((c) => !c.holdover);
  const qualityPost = quality.filter((c) => c.postseason);
  const favOf = (cs) => cs.filter((c) => c.favoriteKey || c.followed);
  const nonStubFresh = wraps.filter((c) => !c.holdover && !isBoxStub(c));
  const nonStub = wraps.filter((c) => !isBoxStub(c));
  const freshWraps = wraps.filter((c) => !c.holdover);
  return favOf(open(picturedFresh))[0] ?? favOf(open(qualityFresh))[0] ?? open(picturedFresh)[0] ?? open(picturedPost)[0] ?? open(pictured)[0] ?? open(qualityFresh)[0] ?? open(qualityPost)[0] ?? open(quality)[0] ?? open(nonStubFresh)[0] ?? open(nonStub)[0] ?? open(freshWraps)[0] ?? open(wraps)[0] ?? (editorLead && !alreadyOnSectionA(editorLead, alreadyOnA1) ? editorLead : void 0) ?? (newsLead && !alreadyOnSectionA(newsLead, alreadyOnA1) ? newsLead : void 0) ?? open(pool)[0] ?? picturedFresh[0] ?? wraps[0] ?? pool[0];
}
function isFreshSectionLead(card, path, edition) {
  if (isWrapLead(card)) {
    if (!card.when) return true;
    if (gameWrapCovers(card.when, edition, path) || card.holdover) return true;
    if (card.postseason) return true;
    if (card.status && /\brecap\b/i.test(card.status)) return true;
    return false;
  }
  if (card.holdover) return false;
  return true;
}
function orderSportSectionFront(cards, path, edition, alreadyOnA1 = []) {
  const seen = /* @__PURE__ */ new Set();
  const unique = cards.filter((card) => {
    if (seen.has(card.id)) return false;
    seen.add(card.id);
    return true;
  });
  const fresh = unique.filter((card) => isFreshSectionLead(card, path, edition));
  const pool = fresh.length ? fresh : unique;
  const wraps = orderSportRecaps(pool.filter(isWrapLead), path);
  const news = pool.filter((card) => !isWrapLead(card)).sort((a, b) => (a.editorRank ?? 99) - (b.editorRank ?? 99) || String(b.when ?? "").localeCompare(String(a.when ?? "")));
  const newsLead = news.find((card) => !isInjuryNote(card));
  const editorLead = pool.find((card) => card.editorFront === 0 && !isInjuryNote(card));
  const lead = pickSectionFrontLead(wraps, pool, editorLead, newsLead, alreadyOnA1);
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
var NATIONAL_PROMO_SENTENCE = /(?:See more of our coverage in your search results\.?|Join Washington Examiner\b[^.!?]{0,220}[.!?]|Subscribe for full access to Washington Examiner\b[^.!?]{0,220}[.!?]|Laura Ingraham,\s+Jesse Watters and Greg Gutfeld bring Fox News viewers[^.!?]{0,180}[.!?])\s*/gi;
function stripNationalPromos(text) {
  return text.replace(NATIONAL_PROMO_SENTENCE, " ").replace(/\bJoin Washington Examiner\b[\s\S]{0,280}?(?:subscriber-only journalism\.?)/gi, " ").replace(/\s{2,}/g, " ").trim();
}
function tidyNationalTicks(text) {
  return text.replace(/(\w)\s+([’‘'`])/g, "$1$2").replace(/(\w)['‘]/g, "$1\u2019");
}
var BODY_MIN = 360;
var OUTLET_SUFFIX = /\s+[—|–-]\s+(?:Fox News|The Wall Street Journal|WSJ|New York Post|Associated Press|AP News|AP|Reuters|National Review|The Daily Wire|Daily Wire|Washington Examiner|Washington Free Beacon|The Dispatch|Yahoo News|Google News)\s*$/i;
function cleanHeadline(title) {
  return title.replace(OUTLET_SUFFIX, "").replace(/\s+/g, " ").trim();
}
var STOP = /* @__PURE__ */ new Set([
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
  "after",
  "amid",
  "against",
  "under",
  "into",
  "onto",
  "over",
  "near",
  "more",
  "than",
  "could",
  "would",
  "should",
  "might",
  "must",
  "also",
  "still",
  "back",
  "down",
  "some"
]);
function significantWords(title) {
  return cleanHeadline(title).toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 3 && !STOP.has(w));
}
function sameStory(a, b) {
  if (!a.length || !b.length) return false;
  const other = new Set(b);
  const shared = a.filter((w) => other.has(w));
  const shorter = Math.min(a.length, b.length);
  if (shared.length >= 3 && shared.length / shorter >= 0.45) return true;
  if (shared.length >= 2 && shared.some((w) => w.length >= 6) && shared.length / shorter >= 0.55) return true;
  return false;
}
var ENTITY_RULES = [
  { id: "b1-bomber", test: (t) => /\bb-?1\b/.test(t) && /\bbomber|lancer|pullout|withdraw/.test(t) },
  {
    id: "scotus-climate",
    test: (t) => /\bsupreme court\b|\bscotus\b|\bjustices\b/.test(t) && /\bclimate|epa|emissions|clean power/.test(t)
  }
];
function storyEntityKeys(title, extra = "") {
  const t = `${title} ${extra}`.toLowerCase();
  return ENTITY_RULES.filter((rule) => rule.test(t)).map((rule) => rule.id);
}
function sameNationalEvent(a, b) {
  const ea = storyEntityKeys(a.title, a.snippet ?? "");
  const eb = storyEntityKeys(b.title, b.snippet ?? "");
  if (ea.some((id) => eb.includes(id))) return true;
  return sameStory(significantWords(a.title), significantWords(b.title));
}
var CAPTION_LEAD = /^(?:watch(?:\s+now)?|video|newsmakers?|tonight on)\b/i;
var SPEAKER_CAPTION = /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3}\s+(?:talks?|discusses|weighs in|breaks down)\b/;
function isLeadCaption(text) {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t || t.length > 220) return false;
  if (CAPTION_LEAD.test(t)) return true;
  if (SPEAKER_CAPTION.test(t)) return true;
  return /\b(?:discusses?|talks? to|weighs in|breaks down)\b/i.test(t) && t.length < 160;
}
function stripLeadCaption(text) {
  const raw = (text ?? "").trim();
  if (!raw) return raw;
  const paras = newspaperParas(raw);
  if (paras.length >= 2 && isLeadCaption(paras[0])) return paras.slice(1).join("\n\n");
  const bits = splitNewspaperSentences(raw);
  if (bits.length >= 2 && isLeadCaption(bits[0])) return bits.slice(1).join(" ");
  return raw;
}
function isPaywallStubNote(note) {
  return /full text was paywalled|printed from the rss brief/i.test(note ?? "");
}
function cleanNationalStories(stories) {
  const out = [];
  for (const raw of stories) {
    const summary = stripLeadCaption(tidyNationalTicks(stripNationalPromos(raw.summary ?? "")));
    const paragraphs = (raw.paragraphs ?? []).map((p) => stripLeadCaption(tidyNationalTicks(stripNationalPromos(p)))).filter(Boolean);
    const body = raw.body ? stripLeadCaption(tidyNationalTicks(stripNationalPromos(raw.body))) : null;
    const paywalled = isPaywallStubNote(raw.bodyNote) || /full text was paywalled/i.test(`${summary} ${body ?? ""}`);
    if (paywalled && !(body && body.length >= BODY_MIN)) {
      if (!summary || /full text was paywalled/i.test(summary)) continue;
    }
    const story = {
      ...raw,
      summary,
      paragraphs: paragraphs.length ? paragraphs : newspaperParas(summary),
      body: paywalled && !(body && body.length >= BODY_MIN) ? null : body,
      bodyNote: paywalled ? null : raw.bodyNote ?? null
    };
    if (out.some(
      (prev) => sameNationalEvent(
        { title: prev.headline, snippet: prev.summary },
        { title: story.headline, snippet: story.summary }
      )
    )) {
      continue;
    }
    out.push(story);
  }
  return out;
}

// src/lib/newspaper-national.ts
var cleanNationalStories2 = cleanNationalStories;

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

// src/lib/newspaper-page.ts
var PAGE_CANVAS = { width: 1040, height: 1480 };
var PAGE_CHROME_PX = 188;
var PAGE_BODY_PX = PAGE_CANVAS.height - PAGE_CHROME_PX;
var NEWS_STORIES_PER_PAGE = 3;
var PRESEASON_MS = 18 * 24 * 60 * 60 * 1e3;
var A2_CLUB_CARDS = 3;
var FORM_CLUBS_PER_PACKED_PAGE = 6;
function planOutlookAndForm(clubCount) {
  const n = Math.max(clubCount, 0);
  const leftoverOffset = A2_CLUB_CARDS;
  const leftoverCount = 0;
  const formOnOutlook = Math.min(n, FORM_CLUBS_PER_PACKED_PAGE);
  const formContinue = [];
  for (let offset = formOnOutlook; offset < n; offset += FORM_CLUBS_PER_PACKED_PAGE) {
    formContinue.push({ offset, count: Math.min(FORM_CLUBS_PER_PACKED_PAGE, n - offset) });
  }
  return { leftoverOffset, leftoverCount, formOnOutlook, formContinue };
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
function sportSectionId(path) {
  const known = KNOWN[path];
  if (known) return { path, ...known };
  const slug = path.split("/").pop() ?? "sport";
  const letters = slug.replace(/[^a-z]/gi, "").toUpperCase().slice(0, 4) || "SP";
  const title = slug.replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return { path, code: letters, title, order: 200 };
}
function leaguePathFromSportLabel(label) {
  const s = (label ?? "").trim().toLowerCase();
  if (s === "nfl" || s === "football") return "football/nfl";
  if (s === "mlb" || s === "baseball") return "baseball/mlb";
  if (s === "nhl" || s === "hockey") return "hockey/nhl";
  if (s === "nba" || s === "basketball") return "basketball/nba";
  if (s === "cfb" || s === "college football") return "football/college-football";
  if (s === "cbb" || s === "college basketball" || s === "ncaam") return "basketball/mens-college-basketball";
  if (s === "epl" || s === "premier league") return "soccer/eng.1";
  if (s === "efl" || s === "championship") return "soccer/eng.2";
  return null;
}
function favoriteKeyFitsCard(key, card) {
  return favoriteKeyFitsPath(key, card.leaguePath || leaguePathFromSportLabel(card.sportLabel), card.sportLabel);
}
function isFavoriteStory(card) {
  if (card.favoriteKey) return favoriteKeyFitsCard(card.favoriteKey, card);
  return false;
}
function isMoScoutCard(card) {
  if (card.sportLabel !== "Missouri") return false;
  return /missouri scout|moscout/i.test(`${card.teamName ?? ""} ${card.caption ?? ""} ${card.wrapHref ?? ""}`);
}
function isTodaysMoScout(card, edition) {
  if (!isMoScoutCard(card)) return false;
  if (!card.when) return true;
  const day = instantDay(card.when);
  const newsDay = editionNewsDay(edition);
  return !day || day === newsDay || day === edition.slice(0, 10);
}
var A1_MUTED_KEYS = /* @__PURE__ */ new Set(["nba-phi"]);
function isA1MutedFavoriteKey(key) {
  return Boolean(key && A1_MUTED_KEYS.has(key));
}
function isNbaCard(card) {
  const path = cardLeaguePath(card);
  return path === "basketball/nba" || /^nba$/i.test(card.sportLabel ?? "");
}
function isA1Muted(card, edition = "") {
  if (isA1MutedFavoriteKey(card.favoriteKey)) return true;
  if (isFrontPreseasonNote(card)) return true;
  if (!isNbaCard(card)) return false;
  if (edition && !sportInSeason("basketball/nba", edition)) return true;
  return !isFavoriteStory(card);
}
function mayFrontA1(card, edition) {
  if (isA1Muted(card, edition)) return false;
  if (isTodaysMoScout(card, edition)) return true;
  if (isHistoricNationalCard(card)) return true;
  return isFavoriteStory(card);
}
function cardLeaguePath(card) {
  return card.leaguePath || leaguePathFromSportLabel(card.sportLabel);
}
function stampFavoriteKeys(stories, clubs) {
  return stories.map((card) => {
    const kept = card.favoriteKey && favoriteKeyFitsCard(card.favoriteKey, card) ? card.favoriteKey : "";
    if (kept) return card.followed ? card : { ...card, favoriteKey: kept, followed: true };
    if (card.favoriteKey && !kept) {
      card = { ...card, favoriteKey: "", followed: false };
    }
    if (!clubs.length) return card;
    const path = cardLeaguePath(card);
    let hit;
    for (const club of clubs) {
      if (club.leaguePath && path && club.leaguePath !== path) continue;
      const fav = {
        key: club.key,
        name: club.shortName,
        shortName: club.shortName,
        sport: "",
        league: "",
        espnPath: club.leaguePath ? `${club.leaguePath}/teams/0` : "",
        kind: "team"
      };
      if (storyMatchesFavorite(card, fav)) {
        hit = club;
        break;
      }
    }
    if (hit) return { ...card, favoriteKey: hit.key, followed: true };
    return card;
  });
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
    return cleanedBodyLength(card) >= 80;
  }
  if (!isFavoriteStory(card)) return false;
  if (card.id.startsWith("news-")) return Boolean(card.headline);
  if (cleanedBodyLength(card) >= 80) return true;
  if (card.status && /final|postponed/i.test(card.status) && card.scoreLine && /\d/.test(card.scoreLine)) {
    return true;
  }
  return false;
}
var STORY_COPY_MIN = 400;
function hasStoryCopy(card) {
  return cleanedBodyLength(card) >= STORY_COPY_MIN;
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
function isFavoriteGameResult(card) {
  if (!isFavoriteStory(card) || isInjuryNote(card)) return false;
  if (isPreviewStory(card) || isBettingPreview(card)) return false;
  return isRecapStory(card) || isGameRecapCopy(card) || isGameWrap(card) || Boolean(card.status && /final/i.test(card.status) && card.scoreLine && /\d/.test(card.scoreLine));
}
function isFrontPreseasonNote(card) {
  if (card.preseason) return true;
  return /\bpreseason\b/i.test(`${card.headline} ${card.dek ?? ""} ${card.status ?? ""}`);
}
function cannotLeadFront(card, pool = []) {
  if (isA1MutedFavoriteKey(card.favoriteKey) || isFrontPreseasonNote(card)) return true;
  if (isNbaCard(card) && !isFavoriteStory(card)) return true;
  if (isHoldoverGame(card)) return true;
  if (isBettingPreview(card)) return true;
  if (pool.length && isStaleGamePreview(card, pool)) return true;
  if (isPreviewStory(card)) return true;
  if (isInjuryNote(card) && pool.some((other) => other.id !== card.id && isFavoriteGameResult(other))) {
    return true;
  }
  if (card.sportLabel === "Missouri" && pool.some((other) => other.id !== card.id && isFavoriteGameResult(other))) {
    return true;
  }
  return false;
}
function leadReplacement(bad, pool, taken) {
  const recap = pool.find(
    (c) => !taken.has(c.id) && c.id !== bad.id && shareMatchup(c, bad) && (isRecapStory(c) || isGameRecapCopy(c) || isGameWrap(c)) && hasStoryCopy(c)
  );
  if (recap) return recap;
  if (!isInjuryNote(bad) && bad.sportLabel !== "Missouri") return null;
  const results = pool.filter((c) => !taken.has(c.id) && c.id !== bad.id && isFavoriteGameResult(c) && hasStoryCopy(c)).sort((a, b) => favoriteDeskWeight(b.favoriteKey ?? "") - favoriteDeskWeight(a.favoriteKey ?? ""));
  return results[0] ?? null;
}
function storyRank(card, edition) {
  const day = card.when ? instantDay(card.when) : null;
  let score = 0;
  if (isBettingPreview(card)) score -= 250;
  if (isPreviewStory(card)) score -= 150;
  if (isInjuryNote(card)) score -= 220;
  if (isFavoriteGameResult(card)) score += 80;
  if (day === editionNewsDay(edition) && card.status && /final/i.test(card.status)) score += 100;
  if (card.postseason) score += 40;
  if (card.id.startsWith("news-")) score += 25;
  if (card.id.startsWith("league-")) score += 10;
  if (isAthleticCard(card)) score += 12;
  if (isRecapStory(card)) score += 20;
  if (cleanedBodyLength(card) >= 400) score += 15;
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
  const score = new Map(cards.map((card) => [card, storyRank(card, edition)]));
  return [...cards].sort((a, b) => {
    const byRank = (score.get(b) ?? 0) - (score.get(a) ?? 0);
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
function upcomingFor(clubs) {
  return sortComingUp(
    clubs.flatMap(
      (club) => club.upcoming.map((game) => ({
        id: game.id,
        team: club.shortName,
        label: game.label,
        when: game.when,
        startIso: game.startIso ?? null,
        detail: game.detail,
        favoriteKey: club.key
      }))
    )
  );
}
var COMING_UP_CLOCK = /\d{1,2}:\d{2}|\d{1,2}\s*[ap](?:\.?m\.?)/i;
var CHICAGO = "America/Chicago";
function chicagoYmd(ms) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CHICAGO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(ms));
}
function endOfChicagoDay(ms) {
  const ymd = chicagoYmd(ms);
  for (const offset of ["-05:00", "-06:00"]) {
    const t = Date.parse(`${ymd}T23:59:59.999${offset}`);
    if (!Number.isNaN(t) && chicagoYmd(t) === ymd) return t;
  }
  return Date.parse(`${ymd}T23:59:59.999-05:00`);
}
function comingUpHasClock(when) {
  return Boolean(when && COMING_UP_CLOCK.test(when));
}
function parseComingUpWhen(when, now) {
  const cleaned = when.replace(/^@\s*[A-Za-z0-9.&']+\s+/i, "").replace(/^(vs\.?|at)\s+[A-Za-z0-9.&']+\s+/i, "").replace(/\bCT\b/g, "").replace(/,/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  const year = new Date(now).getFullYear();
  const attempts = /\b(?:19|20)\d{2}\b/.test(cleaned) ? [cleaned] : [`${cleaned} ${year}`, `${cleaned}, ${year}`];
  for (const text of attempts) {
    const t = Date.parse(text);
    if (Number.isNaN(t)) continue;
    if (t < now - 150 * 864e5) {
      const next = Date.parse(text.replace(String(year), String(year + 1)));
      if (!Number.isNaN(next)) return next;
    }
    return t;
  }
  return null;
}
function comingUpSortMs(game, now = Date.now()) {
  if (game.startIso) {
    const t = Date.parse(game.startIso);
    if (!Number.isNaN(t)) return t;
  }
  const when = game.when?.trim() || "";
  if (!when) return Number.POSITIVE_INFINITY;
  const parsed = parseComingUpWhen(when, now);
  if (parsed == null) return Number.POSITIVE_INFINITY;
  return comingUpHasClock(when) ? parsed : endOfChicagoDay(parsed);
}
function sortComingUp(games, now = Date.now()) {
  return [...games].sort((a, b) => {
    const d = comingUpSortMs(a, now) - comingUpSortMs(b, now);
    if (d !== 0) return d;
    const byDesk = favoriteDeskWeight(b.favoriteKey ?? "") - favoriteDeskWeight(a.favoriteKey ?? "");
    if (byDesk) return byDesk;
    return (a.when ?? "").localeCompare(b.when ?? "");
  });
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
function significantWords2(headline) {
  return headline.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((word) => word.length > 3 && !HEAD_STOP.has(word));
}
function sameStory2(a, b) {
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
  return significantWords2(card.headline).map((word) => aliases[word] ?? word);
}
var SUBJECT_STOP = /* @__PURE__ */ new Set([
  "cardinals",
  "chiefs",
  "lions",
  "cowboys",
  "blues",
  "tigers",
  "bears",
  "packers",
  "giants",
  "yankees",
  "rays",
  "brewers",
  "padres",
  "dodgers",
  "braves",
  "guardians",
  "kansas",
  "city",
  "louis",
  "detroit",
  "dallas",
  "missouri",
  "mizzou",
  "chicago",
  "arizona",
  "england",
  "patriots",
  "raiders",
  "vegas",
  "panthers",
  "falcons",
  "saints",
  "eagles",
  "steelers",
  "ravens",
  "bengals",
  "browns",
  "texans",
  "colts",
  "jaguars",
  "titans",
  "broncos",
  "chargers",
  "seahawks",
  "rams",
  "49ers",
  "niners",
  "commanders",
  "bills",
  "dolphins",
  "jets",
  "vikings",
  "buccaneers",
  "white",
  "sox",
  "cubs",
  "reds",
  "phillies",
  "mets",
  "orioles",
  "twins",
  "mariners",
  "astros",
  "rangers",
  "royals",
  "athletics",
  "nationals",
  "marlins",
  "rockies",
  "angels",
  "pirates",
  "division",
  "series",
  "playoff",
  "playoffs",
  "postseason",
  "walk",
  "single",
  "lifts",
  "beats",
  "beat",
  "win",
  "wins",
  "lead",
  "leads",
  "game",
  "final",
  "week",
  "monday",
  "sunday",
  "saturday",
  "night",
  "analysis",
  "tips",
  "prop",
  "plays",
  "preview"
]);
function distinctiveSubjects(card) {
  return headlineTokens(card).filter((word) => word.length >= 6 && !SUBJECT_STOP.has(word));
}
function seriesGameKey(headline) {
  const m = headline.match(/\b((?:al|nl)ds)\s+game\s+(\d)\b/i);
  return m ? `${m[1].toLowerCase()}-${m[2]}` : null;
}
function sameNamedPackage(a, b) {
  if (a.leaguePath && b.leaguePath && a.leaguePath !== b.leaguePath) return false;
  const seriesA = seriesGameKey(a.headline);
  const seriesB = seriesGameKey(b.headline);
  if (seriesA && seriesB && seriesA === seriesB) return true;
  const left = distinctiveSubjects(a);
  const right = distinctiveSubjects(b);
  if (!left.length || !right.length) return false;
  const shared = left.filter((w) => right.includes(w));
  return shared.length >= 1;
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
    return sameStory2(headlineTokens(a), headlineTokens(b));
  }
  const gameA = storyGameId(a);
  const gameB = storyGameId(b);
  if (gameA && gameB && gameA === gameB) return true;
  if (isGameRecapCopy(a) && isGameRecapCopy(b) && shareMatchup(a, b)) return true;
  if (isMainGameStory(a) && isMainGameStory(b) && sameStory2(headlineTokens(a), headlineTokens(b))) {
    return true;
  }
  if (sameNamedPackage(a, b)) return true;
  return sameStory2(headlineTokens(a), headlineTokens(b));
}
function pickBetterStory(cards) {
  return cards.reduce((best, card) => preferStory(card, best) ? card : best);
}
function dedupePush(groups, card) {
  const hits = [];
  for (let i = 0; i < groups.length; i += 1) {
    if (groups[i].some((prev) => sameSectionAStory(card, prev))) hits.push(i);
  }
  if (!hits.length) {
    groups.push([card]);
    return groups;
  }
  const [first, ...rest] = hits;
  groups[first].push(card);
  for (const i of rest.sort((a, b) => b - a)) {
    groups[first].push(...groups[i]);
    groups.splice(i, 1);
  }
  return groups;
}
function finishDedupe(groups) {
  return groups.map(pickBetterStory);
}
function dedupeStories(stories) {
  const groups = [];
  for (const card of attachInferredGameIds(stories)) dedupePush(groups, card);
  return finishDedupe(groups);
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
  if (isInjuryNote(card)) return false;
  const text = `${card.headline} ${card.dek ?? ""}`.replace(/\s+/g, " ");
  if (MAJOR_NEWS.test(text)) return true;
  return Boolean(
    card.postseason && isRecapStory(card) && /\b(?:advance[sd]?|sweep(?:s|ed)?|game (?:5|7)|series win|win (?:the )?series)\b/i.test(text)
  );
}
function editorFront(fresh, edition = "") {
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
    if (isA1Muted(choice, edition) || !(isFavoriteStory(choice) || isMoScoutCard(choice) || isHistoricNationalCard(choice))) {
      if (choice.sportLabel === "National") continue;
      continue;
    }
    picked.push(choice);
    taken.add(choice.id);
    if (picked.length >= FRONT_STORIES) break;
  }
  return picked;
}
function favoritePages(freshStories, sectionStories, clubs, frontPicks = [], edition = "") {
  const favoriteFolioByStory = {};
  const freshIds = new Set(freshStories.map((c) => c.id));
  const frontPool = [...freshStories, ...sectionStories.filter((c) => !freshIds.has(c.id))];
  const clubOf = (c) => c.favoriteKey ?? c.teamName ?? c.id;
  const picks = [];
  const taken = /* @__PURE__ */ new Set();
  const slotOk = (card) => mayFrontA1(card, edition);
  for (const card of frontPicks) {
    if (picks.length >= FRONT_STORIES) break;
    let choice = card;
    if (cannotLeadFront(card, frontPool) || !slotOk(card)) choice = leadReplacement(card, frontPool, taken);
    if (!choice || taken.has(choice.id) || cannotLeadFront(choice, frontPool) || !slotOk(choice)) continue;
    picks.push(choice);
    taken.add(choice.id);
  }
  const written = frontPool.filter(
    (c) => slotOk(c) && !cannotLeadFront(c, frontPool) && !taken.has(c.id) && !isTodaysMoScout(c, edition)
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
    if (!slotOk(card) || cannotLeadFront(card, frontPool) || taken.has(card.id)) continue;
    picks.push(card);
    taken.add(card.id);
  }
  const scout = frontPool.find((c) => isTodaysMoScout(c, edition));
  if (scout && !taken.has(scout.id)) {
    if (picks.length < FRONT_STORIES) {
      picks.push(scout);
      taken.add(scout.id);
    } else {
      const replaceAt = picks.length - 1;
      const dropped = picks[replaceAt];
      taken.delete(dropped.id);
      picks[replaceAt] = scout;
      taken.add(scout.id);
    }
  }
  const [lead = null, second = null, third = null] = picks;
  for (const card of [lead, second, third]) {
    if (card) favoriteFolioByStory[card.id] = "A1";
  }
  const jumps = [];
  const jumpFolio = "A4";
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
      sectionPage: 4,
      sectionCount: 0,
      continuedFrom: "A1",
      jumps,
      jumpFolio: void 0
    }
  ] : [];
  let n = 4 + continues.length;
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
    briefs: (freshStories.length ? freshStories : sectionStories).filter((c) => !frontIds.has(c.id) && !isA1Muted(c, edition)).slice(0, 6),
    news: (freshStories.length ? freshStories : sectionStories).filter((c) => !isA1Muted(c, edition)),
    leadContinue: leadJump.folio,
    secondContinue: secondJump.folio,
    thirdContinue: thirdJump.folio,
    leadTeaser: leadJump.teaser,
    secondTeaser: secondJump.teaser,
    thirdTeaser: thirdJump.teaser
  };
  const orderedClubs = [...clubs].sort(
    (a, b) => favoriteDeskWeight(b.key) - favoriteDeskWeight(a.key)
  );
  const packed = planOutlookAndForm(orderedClubs.length);
  const weatherToday = {
    kind: "favorites-clubs",
    folio: "A2",
    section: "A",
    sectionTitle: SECTION_A_TITLE,
    sectionPage: 2,
    sectionCount: 0,
    weatherPart: "today",
    clubOffset: 0,
    clubLimit: A2_CLUB_CARDS
  };
  const weatherOutlook = {
    kind: "favorites-clubs",
    folio: "A3",
    section: "A",
    sectionTitle: SECTION_A_TITLE,
    sectionPage: 3,
    sectionCount: 0,
    weatherPart: "outlook",
    clubOffset: packed.leftoverOffset,
    clubLimit: packed.leftoverCount,
    formClubs: orderedClubs.slice(0, packed.formOnOutlook)
  };
  const pages = [front, weatherToday, weatherOutlook, ...continues, ...inside];
  for (const slice of packed.formContinue) {
    const chunk = orderedClubs.slice(slice.offset, slice.offset + slice.count);
    if (!chunk.length) continue;
    const pageN = pages.length + 1;
    pages.push({
      kind: "favorites-form",
      folio: `A${pageN}`,
      section: "A",
      sectionTitle: SECTION_A_TITLE,
      sectionPage: pageN,
      sectionCount: 0,
      clubs: chunk
    });
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
function sportPages(id, clubs, stories, edition, withPlayers = false, offseason = false, withLeaders = false, postseason = false, withCoaches = false, alreadyOnA1 = []) {
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
  const recapPool = orderSportRecaps(
    unique.filter((card) => isGameWrap(card) || isRecapStory(card)),
    id.path
  );
  const newsPool = unique.filter((card) => !isGameWrap(card) && !isSportFiller(card, recapPool)).slice(0, SPORT_NEWS_CAP);
  const newsDay = editionNewsDay(edition);
  const frontPool = orderSportSectionFront([...recapPool, ...newsPool], id.path, edition, alreadyOnA1).filter((card) => {
    if (!(isSectionAStory(card) && (isGameWrap(card) || isRecapStory(card)))) return true;
    if (id.path.startsWith("soccer/")) return true;
    if (favoriteDeskWeight(card.favoriteKey) >= 100) return true;
    const gameDay = card.when ? instantDay(card.when) : null;
    return Boolean(gameDay && gameDay === newsDay);
  });
  const FRONT_SHOW = 6;
  const frontShown = frontPool.slice(0, FRONT_SHOW);
  const shownIds = new Set(frontShown.map((card) => card.id));
  let recapsLeft = recapPool.filter((card) => !shownIds.has(card.id));
  recapsLeft.forEach((card) => shownIds.add(card.id));
  let newsLeft = newsPool.filter((card) => !shownIds.has(card.id));
  if (id.path.includes("college-football") && recapsLeft.length < 6) {
    const pulled = newsLeft.slice(0, 9 - recapsLeft.length);
    recapsLeft = [...recapsLeft, ...pulled];
    const pulledIds = new Set(pulled.map((card) => card.id));
    newsLeft = newsLeft.filter((card) => !pulledIds.has(card.id));
  }
  const storyFocuses = focuses.flatMap((f) => {
    if (!isStoryFocus(f)) return [];
    if (f === "recaps") return recapsLeft.length > 0 ? ["recaps"] : [];
    if (f === "news") {
      if (!newsLeft.length) return [];
      const n = Math.max(1, Math.ceil(newsLeft.length / NEWS_STORIES_PER_PAGE));
      return Array.from({ length: n }, () => "news");
    }
    return [f];
  });
  const refFocuses = focuses.filter((f) => !isStoryFocus(f));
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
  let newsCursor = 0;
  const pages = numbered.map((page, i) => {
    if (page.kind !== "sport-front") return page;
    const nextFront = numbered.slice(i + 1).find((p) => p.kind === "sport-front");
    let newsSlice;
    let pool = page.focus === "front" ? frontShown : page.focus === "news" ? newsLeft : page.focus === "recaps" ? recapsLeft : unique;
    if (page.focus === "news") {
      const offset = newsCursor;
      const count = Math.min(NEWS_STORIES_PER_PAGE, Math.max(newsLeft.length - offset, 0));
      newsSlice = { offset, count };
      pool = newsLeft.slice(offset, offset + count);
      newsCursor += count;
    }
    return {
      ...page,
      sectionDesks,
      newsSlice,
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
  const packed = packNationalPages(cleanNationalStories2(desk.stories));
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
  return dedupeStories(inWindow).map((card) => ({
    ...card,
    headline: printHeadline(card.headline),
    dek: card.dek != null ? printHeadline(card.dek) : card.dek
  }));
}
function buildEdition(opts) {
  const fresh = rankStories(
    deskCopy(stampFavoriteKeys(opts.stories, opts.clubs), opts.edition).filter((card) => !card.editorSpiked),
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
  const a1Picks = editorFront(fresh, opts.edition);
  const favorites = favoritePages(favoriteFresh, favoriteFresh, opts.clubs, a1Picks, opts.edition);
  const a1Front = favorites.pages.find((p) => p.kind === "favorites-front");
  const a1Ran = a1Front?.kind === "favorites-front" ? [a1Front.lead, a1Front.second, a1Front.third].filter((c) => Boolean(c)) : a1Picks;
  const storiesBy = /* @__PURE__ */ new Map();
  for (const story of fresh) {
    if (!story.leaguePath) continue;
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
      opts.coachPaths?.includes(id.path) ?? false,
      id.path.includes("college-football") ? a1Ran.filter((card) => card.leaguePath === id.path) : []
    )
  }));
  const sportFolioByStory = {};
  for (const part of sportPagesBuilt) Object.assign(sportFolioByStory, part.built.sportFolioByStory);
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
  return dropEmptyFolios({
    pages,
    sections,
    sportFolioByStory,
    favoriteFolioByStory: favorites.favoriteFolioByStory
  });
}
function restampEditionPages(pages) {
  const counts = /* @__PURE__ */ new Map();
  for (const page of pages) counts.set(page.section, (counts.get(page.section) ?? 0) + 1);
  const seen = /* @__PURE__ */ new Map();
  const numbered = pages.map((page) => {
    const n = (seen.get(page.section) ?? 0) + 1;
    seen.set(page.section, n);
    return {
      ...page,
      folio: `${page.section}${n}`,
      sectionPage: n,
      sectionCount: counts.get(page.section) ?? n
    };
  });
  return numbered.map((page, i) => {
    if (page.kind !== "sport-front") return page;
    const sectionDesks = numbered.flatMap(
      (p) => p.kind === "sport-front" && p.section === page.section ? [{ focus: p.focus, folio: p.folio }] : []
    );
    const nextFront = numbered.slice(i + 1).find((p) => p.kind === "sport-front" && p.section === page.section);
    return {
      ...page,
      sectionDesks,
      turn: nextFront && nextFront.kind === "sport-front" ? { folio: nextFront.folio, focus: nextFront.focus } : null
    };
  });
}
function editionPageHasInk(page) {
  switch (page.kind) {
    case "favorites-front":
      return true;
    case "favorites-clubs":
      return true;
    case "favorites-form":
      return page.clubs.length > 0;
    case "favorites-inside":
      return Boolean(page.primary);
    case "favorites-continue":
      return page.jumps.length > 0;
    case "favorites-watch":
      return true;
    case "favorites-day":
      return page.events.length > 0 || (page.upcoming?.length ?? 0) > 0;
    case "favorites-beez":
      return true;
    case "favorites-races":
      return page.races.length > 0;
    case "sport-front":
      if (page.focus === "front" || page.focus === "recaps" || page.focus === "news" || page.focus === "opener") {
        return page.articles.length > 0 || page.clubs.length > 0;
      }
      return true;
    case "sport-inside":
      return Boolean(page.primary);
    case "national":
      return page.stories.length > 0;
    case "missouri":
      return page.items.length > 0;
    default:
      return true;
  }
}
function dropEmptyFolios(edition) {
  const pages = edition.pages.filter(editionPageHasInk);
  if (pages.length === edition.pages.length) return edition;
  const restamped = restampEditionPages(pages);
  const sportFolioByStory = { ...edition.sportFolioByStory };
  const favoriteFolioByStory = { ...edition.favoriteFolioByStory };
  for (const page of restamped) {
    if (page.kind === "sport-inside") {
      sportFolioByStory[page.primary.id] = page.folio;
      if (page.secondary) sportFolioByStory[page.secondary.id] = page.folio;
    }
    if (page.kind === "favorites-inside") {
      favoriteFolioByStory[page.primary.id] = page.folio;
      if (page.secondary) favoriteFolioByStory[page.secondary.id] = page.folio;
    }
    if (page.kind === "favorites-front") {
      for (const card of [page.lead, page.second, page.third]) {
        if (card) favoriteFolioByStory[card.id] = page.folio;
      }
    }
  }
  const sections = edition.sections.map((section) => {
    const index = restamped.findIndex((page) => page.section === section.code);
    return {
      ...section,
      pages: restamped.filter((page) => page.section === section.code).length,
      index: index < 0 ? section.index : index,
      folio: restamped.find((page) => page.section === section.code)?.folio ?? section.folio
    };
  }).filter((section) => section.pages > 0);
  return { ...edition, pages: restamped, sections, sportFolioByStory, favoriteFolioByStory };
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
