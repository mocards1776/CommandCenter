/** Persist “open RSS (standalone), not Dashboard” across Home Screen launches. */
const KEY = "rss-solo";

export function markRssSolo() {
  try {
    localStorage.setItem(KEY, "1");
    sessionStorage.setItem(KEY, "1");
  } catch {
    // private mode
  }
}

export function clearRssSolo() {
  try {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem(KEY);
  } catch {
    // private mode
  }
}

export function prefersRssHome(): boolean {
  try {
    return localStorage.getItem(KEY) === "1" || sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}
