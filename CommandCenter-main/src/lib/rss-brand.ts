/** App chrome brand while an article is open — publisher name, never "Dispatch". */

type Listener = (label: string | null) => void;

let current: string | null = null;
const listeners = new Set<Listener>();

export function getRssReaderBrand(): string | null {
  return current;
}

export function setRssReaderBrand(label: string | null) {
  const next = label?.trim() || null;
  if (next === current) return;
  current = next;
  listeners.forEach((fn) => fn(current));
}

export function subscribeRssReaderBrand(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
