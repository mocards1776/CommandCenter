
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
function isResultCopy(input) {
  const kind = `${input.type ?? ""} ${input.status ?? ""}`.toLowerCase();
  if (/\brecap\b/.test(kind)) return true;
  if (input.status && /final/i.test(input.status) && input.scoreLine && /\d/.test(input.scoreLine)) {
    return true;
  }
  const hay = `${input.headline ?? ""} ${input.dek ?? ""}`.toLowerCase();
  return /\bin (?:a |the )?(?:win|loss|defeat)\b/.test(hay) || /\bwin (?:over|vs\.?|against)\b/.test(hay) || /\b(?:beat|defeated|edged|routed|downed|topped) the\b/.test(hay) || /\b(?:lifts|lifted)\b[^.]{0,48}\b(?:win|victory)\b/.test(hay) || /\bposts? \d+ points\b/.test(hay) || /\brecaps?\b/.test(hay) || /\b\d{1,3}\s*[-–]\s*\d{1,3}\s+(?:win|loss|victory|defeat)\b/.test(hay);
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
function stripModules(text) {
  return text.replace(
    /\bWE ASKED OUR REPORTERS\b.{0,1400}?(?=\s(?:Now|The|But|If|Asked|He|She|They|In|When|After|Before|It|That|This|So)\b)/i,
    " "
  ).replace(/\bKey links:\s*.+$/i, " ").replace(/\s{2,}/g, " ").trim();
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
function cleanStoryCopy(text) {
  let raw = (text ?? "").replace(/\s+/g, " ").trim();
  if (!raw) return { author: null, text: "" };
  const cut = raw.search(JUNK_CUT);
  if (cut >= 0) raw = raw.slice(0, cut).trim();
  raw = stripModules(raw);
  raw = stripLeadingMenu(raw);
  const lifted = liftByline(raw);
  raw = lifted.text;
  if (!raw || isNavSoup(raw)) return { author: lifted.author, text: "" };
  return { author: lifted.author, text: raw };
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
  const outlet = outletFor(card.wrapHref) ?? outletFor(card.feedUrl) ?? outletFor(card.gameHref);
  if (outlet === "ESPN" && /\bAP\b|Associated Press/.test(card.body?.slice(-400) ?? "")) return "The Associated Press";
  if (outlet) return outlet;
  const host = hostOf(card.wrapHref) ?? hostOf(card.feedUrl);
  if (!host || host.endsWith("rss.app")) return null;
  const base = host.split(".").slice(-2, -1)[0] ?? host;
  return base.charAt(0).toUpperCase() + base.slice(1);
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
function isAthleticCard(card) {
  if (card.caption === "The Athletic" || card.id.startsWith("athletic-")) return true;
  const href = `${card.feedUrl ?? ""} ${card.wrapHref ?? ""}`;
  return /theathletic\.com|\/athletic\/rss\//i.test(href);
}
function isDeskStory(card) {
  if (killedSource(card.wrapHref) || killedSource(card.feedUrl) || killedSource(card.gameHref)) return false;
  if (isPeripheralClubStory(card)) return false;
  if (isAthleticCard(card)) return Boolean(card.headline && card.leaguePath);
  if (card.id.startsWith("league-")) return Boolean(card.headline && card.leaguePath);
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
function storyRank(card, edition) {
  const day = card.when ? instantDay(card.when) : null;
  let score = 0;
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
  const used = /* @__PURE__ */ new Set(["A", "B"]);
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
function preferStory(next, prev) {
  const rank = sourceRank(next) - sourceRank(prev);
  if (rank) return rank < 0;
  return cleanStoryCopy(next.body).text.length > cleanStoryCopy(prev.body).text.length;
}
function dedupeStories(stories) {
  const kept = [];
  for (const card of stories) {
    const mine = significantWords(card.headline);
    const idx = kept.findIndex((prev) => {
      if (card.gameId && prev.gameId && card.gameId === prev.gameId) return true;
      return sameStory(mine, significantWords(prev.headline));
    });
    if (idx < 0) {
      kept.push(card);
      continue;
    }
    if (preferStory(card, kept[idx])) kept[idx] = card;
  }
  return kept;
}
function isStalePreview(card, edition) {
  if (isRecapStory(card)) return false;
  const hay = `${card.headline} ${card.status ?? ""} ${card.dek ?? ""}`;
  if (!/\bpreview\b|\bbreak skid\b|\blook to\b|\binto game\b|\bprobable\b/i.test(hay)) {
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
var LEAGUE_FRONT_MAX = 1;
function editorFront(fresh) {
  let league = 0;
  return fresh.filter((card) => card.editorFront != null && card.editorFront < FRONT_STORIES && hasStoryCopy(card)).sort((a, b) => a.editorFront - b.editorFront).filter((card) => {
    if (isFavoriteStory(card)) return true;
    if (league >= LEAGUE_FRONT_MAX || !isMajorStory(card)) return false;
    league += 1;
    return true;
  });
}
function favoritePages(freshStories, sectionStories, clubs, frontPicks = []) {
  const favoriteFolioByStory = {};
  const freshIds = new Set(freshStories.map((c) => c.id));
  const frontPool = [...freshStories, ...sectionStories.filter((c) => !freshIds.has(c.id))];
  const picks = frontPicks.slice(0, FRONT_STORIES);
  const clubOf = (c) => c.favoriteKey ?? c.teamName ?? c.id;
  const written = frontPool.filter((c) => hasStoryCopy(c) && !isPreviewStory(c));
  for (const card of written) {
    if (picks.length >= 3) break;
    if (!picks.some((f) => clubOf(f) === clubOf(card))) picks.push(card);
  }
  for (const card of [...written, ...frontPool]) {
    if (picks.length >= 3) break;
    if (!picks.includes(card)) picks.push(card);
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
      sectionTitle: "Favorite Teams",
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
      sectionTitle: "Favorite Teams",
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
    sectionTitle: "Favorite Teams",
    sectionPage: 1,
    sectionCount: 0,
    lead,
    second,
    third,
    briefs: (freshStories.length ? freshStories : sectionStories).slice(
      FRONT_STORIES,
      FRONT_STORIES + 6
    ),
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
    sectionTitle: "Favorite Teams",
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
      sectionTitle: "Favorite Teams",
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
    sectionTitle: "Favorite Teams",
    sectionPage: watchN,
    sectionCount: 0
  });
  return {
    pages: stampCounts(pages),
    favoriteFolioByStory
  };
}
function sportPages(id, clubs, stories, edition, withPlayers = false, offseason = false, withLeaders = false) {
  const upcoming = upcomingFor(clubs);
  const sportFolioByStory = {};
  const unique = dedupeStories(stories.filter((card) => !isStalePreview(card, edition)));
  const isMlb = id.path === "baseball/mlb";
  const desk = isDeskPress(edition);
  const INSIDE_CAP = 6;
  const leaders = withLeaders ? ["leaders"] : [];
  const players = withPlayers ? ["players"] : [];
  const focuses = offseason ? ["news", "opener", "teams", ...leaders, ...players] : desk ? ["teams", isMlb ? "playoffs" : "form", ...leaders, "schedule", "news", ...players] : ["news", "recaps", "teams", ...leaders, "schedule", isMlb ? "playoffs" : "form", ...players];
  const deskCount = focuses.length;
  const inside = [];
  const full = desk ? [] : unique.filter(hasStoryCopy).slice(0, INSIDE_CAP);
  let n = deskCount + 1;
  for (let i = 0; i < full.length; i += 2) {
    const primary = full[i];
    const secondary = full[i + 1];
    const folio = `${id.code}${n}`;
    sportFolioByStory[primary.id] = folio;
    if (secondary) sportFolioByStory[secondary.id] = folio;
    inside.push({
      kind: "sport-inside",
      folio,
      section: id.code,
      sectionTitle: id.title,
      sectionPage: n,
      sectionCount: 0,
      path: id.path,
      primary,
      secondary
    });
    n += 1;
  }
  const articles = unique.map((card) => ({
    card,
    folio: sportFolioByStory[card.id] ?? `${id.code}1`
  }));
  const newsArticles = articles.slice(0, 12);
  const recapArticles = articles.filter((a) => isRecapStory(a.card)).slice(0, 8);
  const desks = focuses.map((focus, i) => ({
    section: id.code,
    sectionTitle: id.title,
    sectionCount: 0,
    path: id.path,
    clubs,
    upcoming,
    kind: "sport-front",
    folio: `${id.code}${i + 1}`,
    sectionPage: i + 1,
    focus,
    offseason,
    turn: focuses[i + 1] ? { folio: `${id.code}${i + 2}`, focus: focuses[i + 1] } : null,
    articles: focus === "news" ? newsArticles : focus === "recaps" ? recapArticles : articles
  }));
  return {
    pages: stampCounts([...desks, ...inside]),
    sportFolioByStory
  };
}
var MO_FRONT = 11;
var MO_PAGE = 16;
function missouriPages(desk) {
  if (!desk?.items.length) return [];
  const chunks = [desk.items.slice(0, MO_FRONT)];
  for (let i = MO_FRONT; i < desk.items.length && chunks.length < 3; i += MO_PAGE) {
    chunks.push(desk.items.slice(i, i + MO_PAGE));
  }
  return stampCounts(
    chunks.map((items, i) => ({
      kind: "missouri",
      folio: `B${i + 1}`,
      section: "B",
      sectionTitle: "Missouri",
      sectionPage: i + 1,
      sectionCount: 0,
      items,
      listen: i === 0 ? desk.listen : []
    }))
  );
}
function deskCopy(stories, edition) {
  return dedupeStories(
    stories.filter((card) => isDeskStory(card) && !isNewsMuted(card) && !staleNamedPackage(card, edition))
  ).filter((card) => inEditionWindow(card, edition));
}
function buildEdition(opts) {
  const fresh = rankStories(
    deskCopy(opts.stories, opts.edition).filter((card) => !card.editorSpiked),
    opts.edition
  );
  const sectionCopy = fresh;
  const paths = /* @__PURE__ */ new Set();
  for (const club of opts.clubs) if (club.leaguePath) paths.add(club.leaguePath);
  for (const story of sectionCopy) if (story.leaguePath) paths.add(story.leaguePath);
  const ids = uniqueCodes(
    [...paths].map(sportSectionId).sort((a, b) => a.order - b.order || a.code.localeCompare(b.code))
  );
  const clubsBy = /* @__PURE__ */ new Map();
  for (const club of opts.clubs) {
    if (!club.leaguePath) continue;
    const list = clubsBy.get(club.leaguePath) ?? [];
    list.push(club);
    clubsBy.set(club.leaguePath, list);
  }
  const storiesBy = /* @__PURE__ */ new Map();
  for (const story of sectionCopy) {
    if (!story.leaguePath || isFavoriteStory(story)) continue;
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
      opts.leaderPaths?.includes(id.path) ?? false
    )
  }));
  const sportFolioByStory = {};
  for (const part of sportPagesBuilt) Object.assign(sportFolioByStory, part.built.sportFolioByStory);
  const favoriteFresh = fresh.filter(isFavoriteStory);
  const favorites = favoritePages(favoriteFresh, favoriteFresh, opts.clubs, editorFront(fresh));
  const mo = missouriPages(opts.missouri ?? null);
  const pages = [...favorites.pages, ...mo];
  const sections = [
    {
      code: "A",
      title: "Favorite Teams",
      folio: "A1",
      index: 0,
      stories: favoriteFresh.length,
      upcoming: opts.clubs.reduce((n, club) => n + Math.min(1, club.upcoming.length), 0),
      pages: favorites.pages.length
    }
  ];
  if (mo.length) {
    sections.push({
      code: "B",
      title: "Missouri",
      folio: "B1",
      index: favorites.pages.length,
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
