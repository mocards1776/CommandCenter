/**
 * The only Command Center account today (auth.users).
 * Asking spends the server-side XAI_API_KEY, so the edge function accepts
 * this user and nobody else. Email comes from GoTrue (auth.users.email),
 * not from editable user_metadata.
 *
 * Keep in sync with CommandCenter-main/src/lib/player-ask.ts.
 */
export const OWNER_USER_ID = "0a04c242-4b3a-4cac-8441-3844c3d57da0";
export const OWNER_EMAIL = "josh@thompsoncommunications.net";

export function isAskOwner(user: { id?: string | null; email?: string | null } | null | undefined): boolean {
  const id = user?.id?.trim() ?? "";
  const email = user?.email?.trim().toLowerCase() ?? "";
  return id === OWNER_USER_ID && email === OWNER_EMAIL;
}
