/** Persist “open Reading, not Dashboard” across Home Screen launches. */
const KEY = "reading-solo";

export function markReadingSolo() {
  try {
    localStorage.setItem(KEY, "1");
    sessionStorage.setItem(KEY, "1");
  } catch {
    // private mode
  }
}

export function clearReadingSolo() {
  try {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem(KEY);
  } catch {
    // private mode
  }
}

export function prefersReadingHome(): boolean {
  try {
    return localStorage.getItem(KEY) === "1" || sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/** Where signed-in users land when `/` or post-login has no explicit next. */
export function homePath(): string {
  try {
    // Sports Home Screen preference (set from /sports.html).
    if (
      localStorage.getItem("sports-solo") === "1" ||
      sessionStorage.getItem("sports-solo") === "1"
    ) {
      return "/sports?solo=1";
    }
    if (
      localStorage.getItem("rss-solo") === "1" ||
      sessionStorage.getItem("rss-solo") === "1"
    ) {
      return "/rss?solo=1";
    }
  } catch {
    // private mode
  }
  return prefersReadingHome() ? "/reading?solo=1" : "/dashboard";
}

/** Only same-origin relative paths — never protocol-relative or off-site. */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  if (raw.startsWith("/login")) return null;
  return raw;
}
