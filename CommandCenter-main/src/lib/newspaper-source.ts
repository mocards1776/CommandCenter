/** Who filed a story: the publisher behind its link, in newspaper style. */

const OUTLETS: [RegExp, string][] = [
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
  [/(^|\.)ky3\.com$/, "KY3"],
  [/(^|\.)ozarksfirst\.com$/, "KOLR"],
  [/(^|\.)mlbtraderumors\.com$/, "MLB Trade Rumors"],
  [/(^|\.)powermizzou\.com$/, "PowerMizzou"],
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
  [/(^|\.)skysports\.com$/, "Sky Sports"],
];

function hostOf(url: string | null | undefined): string | null {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

/** Publisher name for a link, or null when the link is internal or unknown. */
export function outletFor(url: string | null | undefined): string | null {
  const host = hostOf(url);
  if (!host) return null;
  for (const [re, name] of OUTLETS) if (re.test(host)) return name;
  return null;
}

/**
 * The credit line's outlet. ESPN's AP recaps end on an AP plug, so they are
 * credited to the wire that wrote them.
 */
export function storySource(card: {
  wrapHref?: string | null;
  gameHref?: string | null;
  feedUrl?: string | null;
  body?: string | null;
  wrapKind?: "espn" | "box" | null;
  caption?: string | null;
}): string | null {
  if (card.wrapKind === "box" || card.caption === "Times box wrap") return "Times box wrap";
  const outlet = outletFor(card.wrapHref) ?? outletFor(card.feedUrl) ?? outletFor(card.gameHref);
  if (outlet === "ESPN" && /\bAP\b|Associated Press/.test(card.body?.slice(-400) ?? "")) return "The Associated Press";
  if (outlet) return outlet;
  const host = hostOf(card.wrapHref) ?? hostOf(card.feedUrl);
  if (!host || host.endsWith("rss.app")) return null;
  const base = host.split(".").slice(-2, -1)[0] ?? host;
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/** Site taglines that feeds pass off as a story's dek. */
export function isBoilerplateDek(dek: string | null | undefined): boolean {
  if (!dek) return false;
  return /your (best|source|home|destination) (source |for )?|news, rumors|from the fan perspective|subscribe (now|today)|sign up for|all rights reserved/i.test(
    dek,
  );
}
