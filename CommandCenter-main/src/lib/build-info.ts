/** Build / deploy identity shown when tapping the app logo. */

export type AppBuildInfo = {
  /** Short git SHA when available */
  commit: string;
  /** ISO timestamp of the commit / deploy */
  committedAt: string;
  /** Human label for the UI */
  label: string;
};

function env(name: string): string {
  try {
    const v = (import.meta.env as Record<string, string | undefined>)[name];
    return typeof v === "string" ? v.trim() : "";
  } catch {
    return "";
  }
}

/** Resolve version metadata injected at build time (see vite.config.ts). */
export function getAppBuildInfo(): AppBuildInfo {
  const commit =
    env("VITE_APP_COMMIT") ||
    env("VITE_VERCEL_GIT_COMMIT_SHA") ||
    "dev";
  const short = commit.length > 7 ? commit.slice(0, 7) : commit;
  const committedAt =
    env("VITE_APP_COMMIT_TIME") ||
    env("VITE_VERCEL_GIT_COMMIT_DATE") ||
    new Date().toISOString();

  let when = committedAt;
  try {
    const d = new Date(committedAt);
    if (!Number.isNaN(d.getTime())) {
      when = d.toLocaleString("en-US", {
        timeZone: "America/Chicago",
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      });
    }
  } catch {
    /* keep raw */
  }

  return {
    commit: short,
    committedAt,
    label: `v${short} · pushed ${when}`,
  };
}
