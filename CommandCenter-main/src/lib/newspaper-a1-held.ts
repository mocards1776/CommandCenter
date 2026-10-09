import { useSyncExternalStore } from "react";
import type { GameWrapCard } from "@/lib/newspaper-sports";

/**
 * Stories pulled off A1 by the fit lock. Ids only grow until the edition
 * key (edition id + pager width + story ids) changes. The card registry is
 * filled by the front page so the next folio can print the full story.
 */
type HeldState = { key: string; ids: string[] };

let held: HeldState = { key: "", ids: [] };
const cards = new Map<string, GameWrapCard>();
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function registerHeldCard(card: GameWrapCard): void {
  cards.set(card.id, card);
}

export function publishA1Held(key: string, ids: readonly string[]): void {
  const incoming = [...new Set(ids.filter(Boolean))];
  if (held.key === key) {
    let changed = false;
    const next = held.ids.slice();
    for (const id of incoming) {
      if (next.includes(id)) continue;
      next.push(id);
      changed = true;
    }
    if (!changed) return;
    held = { key, ids: next };
  } else {
    held = { key, ids: incoming };
  }
  emit();
}

export function subscribeA1Held(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getA1Held(): string[] {
  return held.ids;
}

export function useA1Held(): string[] {
  return useSyncExternalStore(subscribeA1Held, getA1Held, getA1Held);
}

export function heldCard(id: string): GameWrapCard | undefined {
  return cards.get(id);
}
