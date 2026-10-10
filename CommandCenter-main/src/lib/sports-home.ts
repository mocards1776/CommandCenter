/** Persist “open Sports (standalone), not Dashboard” across Home Screen launches. */
const KEY = "sports-solo";

export function markSportsSolo() {
  try {
    localStorage.setItem(KEY, "1");
    sessionStorage.setItem(KEY, "1");
  } catch {
    // private mode
  }
}

export function clearSportsSolo() {
  try {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem(KEY);
  } catch {
    // private mode
  }
}

export function prefersSportsHome(): boolean {
  try {
    return localStorage.getItem(KEY) === "1" || sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Where `/sports` should send a visit that is just opening the app.
 * Team pages, the golf drawer, and the explicit teams board stay on `/sports`.
 * Returns null when this visit should render the teams board.
 */
export function sportsHomeRedirect(search: string): string | null {
  const params = new URLSearchParams(search.replace(/^\?/, ""));
  if (params.has("team") || params.get("golf") === "1" || params.get("teams") === "1") return null;
  const q = params.toString();
  return q ? `/sports/ruwt?${q}` : "/sports/ruwt";
}
