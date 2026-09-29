/** Persist “open Thompson Times (standalone), not Dashboard” across Home Screen launches. */
const KEY = "newspaper-solo";

export function markNewspaperSolo() {
  try {
    localStorage.setItem(KEY, "1");
    sessionStorage.setItem(KEY, "1");
  } catch {
    // private mode
  }
}

export function clearNewspaperSolo() {
  try {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem(KEY);
  } catch {
    // private mode
  }
}

export function prefersNewspaperHome(): boolean {
  try {
    return localStorage.getItem(KEY) === "1" || sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}
