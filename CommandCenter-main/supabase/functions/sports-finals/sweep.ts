/**
 * Sweep planning and delivery bookkeeping for the finals cron.
 *
 * Rendering a card (resvg + JPEG) costs most of the 2s per-request CPU cap on
 * a cold isolate, so the sweep never renders. Each wanted final is posted to
 * this function's own `deliver` action, one request at a time, so every card
 * gets a fresh CPU budget. `deliver` renders before it claims the sent row; a
 * request killed mid-render leaves no claim, and the next sweep retries it.
 */
import { gameKey, gamePhase, type PushGame } from "../sports-push/live-drama.ts";
import { alwaysSendsFinal, shouldSendFinal, type FavoriteToken, type FinalsScope, type WatchSnap } from "./select.ts";

/** Upper bound on deliver requests per sweep (cron is every 2 minutes). */
export const MAX_SENDS = 6;
/** Do not start another deliver request after this much of the sweep has passed. */
export const SWEEP_DELIVER_BUDGET_MS = 40_000;
/** One deliver can wait ~60s for NHL three stars before it renders. */
export const DELIVER_TIMEOUT_MS = 95_000;

export type SweepRow = {
  key: string;
  game: PushGame;
  before: WatchSnap | null;
  phase: WatchSnap["phase"];
  everHot: boolean;
  want: boolean;
  always: boolean;
};

export type DeliverOutcome = { status: "sent" | "dup" } | { status: "retry"; error: string };

export function planSweep(opts: {
  games: PushGame[];
  prev: Map<string, WatchSnap>;
  sent: Set<string>;
  scope: FinalsScope;
  favorites: FavoriteToken[];
  power4Cfb: ReadonlySet<string>;
  hot: (game: PushGame) => boolean;
}): SweepRow[] {
  return opts.games.map((game) => {
    const key = gameKey(game);
    const before = opts.prev.get(key) ?? null;
    const phase = gamePhase(game);
    const everHot = Boolean(before?.everHot) || opts.hot(game);
    const always = alwaysSendsFinal(game.sport, key, opts.power4Cfb);
    const want = shouldSendFinal({
      scope: opts.scope,
      favorites: opts.favorites,
      sport: game.sport,
      away: { id: game.away.id, abbrev: game.away.abbrev },
      home: { id: game.home.id, abbrev: game.home.abbrev },
      prev: before,
      nextPhase: phase,
      everHot,
      alreadySent: opts.sent.has(key),
      always,
    });
    return { key, game, before, phase, everHot, want, always };
  });
}

export type DeliveryReport = {
  /** Phase to store per key; wanted games that did not land keep their old phase so the next sweep retries. */
  phases: Map<string, WatchSnap["phase"]>;
  delivered: string[];
  dup: string[];
  deferred: string[];
  errors: { game: string; error: string }[];
};

export async function runDeliveries(
  rows: SweepRow[],
  deliver: (game: PushGame) => Promise<DeliverOutcome>,
  opts: { cap?: number; budgetMs?: number; now?: () => number } = {},
): Promise<DeliveryReport> {
  const cap = opts.cap ?? MAX_SENDS;
  const budgetMs = opts.budgetMs ?? SWEEP_DELIVER_BUDGET_MS;
  const now = opts.now ?? (() => Date.now());
  const started = now();
  const report: DeliveryReport = { phases: new Map(), delivered: [], dup: [], deferred: [], errors: [] };
  let attempts = 0;
  for (const row of rows) {
    report.phases.set(row.key, row.phase);
    if (!row.want || !row.before) continue;
    if (attempts >= cap || now() - started >= budgetMs) {
      report.phases.set(row.key, row.before.phase);
      report.deferred.push(row.key);
      continue;
    }
    attempts += 1;
    let outcome: DeliverOutcome;
    try {
      outcome = await deliver(row.game);
    } catch (err) {
      outcome = { status: "retry", error: err instanceof Error ? err.message : "deliver failed" };
    }
    if (outcome.status === "sent") report.delivered.push(row.key);
    else if (outcome.status === "dup") report.dup.push(row.key);
    else if (outcome.status === "retry") {
      report.phases.set(row.key, row.before.phase);
      report.errors.push({ game: row.key, error: outcome.error });
    }
  }
  return report;
}

export type DeliverResult =
  | { status: "sent"; value: unknown }
  | { status: "dup" }
  | { status: "not-final" }
  | { status: "error"; error: string; stage: "claim" | "send" };

/**
 * Order matters: render (`prepare`) before `claim`. Claiming first is what
 * left Oct 11 NFL games marked sent when the worker hit its CPU cap mid-render.
 */
export async function deliverOnce<C, P>(steps: {
  alreadySent: () => Promise<boolean>;
  load: () => Promise<C & { final: boolean }>;
  prepare: (card: C & { final: boolean }) => Promise<P>;
  claim: () => Promise<"ok" | "dup" | "error">;
  send: (prepared: P) => Promise<unknown>;
  release: () => Promise<void>;
}): Promise<DeliverResult> {
  if (await steps.alreadySent()) return { status: "dup" };
  const card = await steps.load();
  if (!card.final) return { status: "not-final" };
  const prepared = await steps.prepare(card);
  const claimed = await steps.claim();
  if (claimed === "dup") return { status: "dup" };
  if (claimed === "error") return { status: "error", error: "claim failed", stage: "claim" };
  try {
    return { status: "sent", value: await steps.send(prepared) };
  } catch (err) {
    await steps.release();
    return { status: "error", error: err instanceof Error ? err.message : "send failed", stage: "send" };
  }
}

/** Map a `deliver` HTTP response to an outcome. 546 is Supabase's CPU/memory kill. */
export function parseDeliverResponse(status: number, text: string): DeliverOutcome {
  let body: { status?: unknown; error?: unknown } = {};
  try {
    body = text ? (JSON.parse(text) as typeof body) : {};
  } catch {
    body = {};
  }
  if (status >= 200 && status < 300 && (body.status === "sent" || body.status === "dup")) {
    return { status: body.status };
  }
  const detail = typeof body.error === "string" && body.error ? body.error : typeof body.status === "string" ? body.status : "";
  const label = status === 546 ? "worker limit (546)" : `deliver ${status}`;
  return { status: "retry", error: detail ? `${label}: ${detail}` : label };
}
