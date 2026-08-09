/** Persist “open MLB / Sports, not Dashboard” across Home Screen launches. */
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
