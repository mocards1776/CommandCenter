/** Division / conference place chips under a team's record. */

export function ordinalPlace(n: number): string {
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return `${n}st`;
  if (j === 2 && k !== 12) return `${n}nd`;
  if (j === 3 && k !== 13) return `${n}rd`;
  return `${n}th`;
}

/** "American Football Conference West Division" → "AFC West". */
export function shortDivisionLabel(name: string): string {
  return name
    .replace(/^\d{4}(-\d{2})?\s+/, "")
    .replace(/\bAmerican Football Conference\b/gi, "AFC")
    .replace(/\bNational Football Conference\b/gi, "NFC")
    .replace(/\bAmerican League\b/gi, "AL")
    .replace(/\bNational League\b/gi, "NL")
    .replace(/\bEastern Conference\b/gi, "East")
    .replace(/\bWestern Conference\b/gi, "West")
    .replace(/\s+Division\b/gi, "")
    .replace(/\s+Conference\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Conference-only labels ("AFC") are not a place in the division. */
export function isBareConferenceLabel(name: string): boolean {
  return /^(AFC|NFC|AL|NL|East|West)$/i.test(name.trim());
}

/** Josh's chip: "1st AFC West". Bare "AFC" is omitted. */
export function formatDivisionPlace(place: number, groupName: string): string | null {
  const group = shortDivisionLabel(groupName);
  if (!group || isBareConferenceLabel(group)) return null;
  if (!Number.isFinite(place) || place < 1) return null;
  return `${ordinalPlace(place)} ${group}`;
}

/**
 * Smallest ESPN standings group that contains the club (division over conference).
 * Place is the row order in that table — not playoff seed.
 */
export function standingLineFromEspnTree(raw: unknown, teamId: string | number): string | null {
  const id = String(teamId);
  type Group = { name: string; ids: string[] };
  const groups: Group[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const body = node as {
      name?: string;
      shortName?: string;
      abbreviation?: string;
      standings?: { entries?: { team?: { id?: string | number } }[] };
      children?: unknown[];
    };
    const name = (body.name || body.shortName || body.abbreviation || "").trim();
    const ids = (body.standings?.entries ?? [])
      .map((entry) => (entry.team?.id != null ? String(entry.team.id) : ""))
      .filter(Boolean);
    if (ids.length) groups.push({ name, ids });
    for (const child of body.children ?? []) walk(child);
  };
  walk(raw);
  const hits = groups.filter((group) => group.ids.includes(id));
  hits.sort((a, b) => {
    const aBare = isBareConferenceLabel(shortDivisionLabel(a.name));
    const bBare = isBareConferenceLabel(shortDivisionLabel(b.name));
    if (aBare !== bBare) return aBare ? 1 : -1;
    return a.ids.length - b.ids.length;
  });
  for (const group of hits) {
    const line = formatDivisionPlace(group.ids.indexOf(id) + 1, group.name);
    if (line) return line;
  }
  return null;
}
