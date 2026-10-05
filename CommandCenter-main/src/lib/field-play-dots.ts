/** One scrimmage snap. The live overlay uses a capsule now; this layout stays for tests. */
export type DrivePlayDot = {
  pct: number;
  /** Horizontal nudge, in px, when a cluster needs a second column. */
  x: number;
  /** Vertical nudge, in px, so dots at the same spot stay readable. */
  y: number;
};

/** Plays within this many yards share a stack. */
const CLUSTER_YARDS = 1.75;
const MAX_ROWS = 5;
/**
 * Dot plus the gap. Wide enough that the outer dots in a cluster clear the
 * possession logo instead of disappearing behind it.
 */
const STEP = 16;

/**
 * Place each current-drive snap on the field.
 * Spots within about two yards stack up the field, then spill into a second
 * column, so a goal-line sequence does not become one blob.
 */
export function layoutDrivePlayDots(homeYardLines: number[]): DrivePlayDot[] {
  const spots = homeYardLines
    .map((yard, i) => {
      if (typeof yard !== "number" || !Number.isFinite(yard)) return null;
      const pct = Math.max(0, Math.min(100, 100 - yard));
      return { pct, i };
    })
    .filter((spot): spot is { pct: number; i: number } => spot != null);

  const order = [...spots].sort((a, b) => a.pct - b.pct || a.i - b.i);
  const clusters: { pct: number; i: number }[][] = [];
  for (const spot of order) {
    const last = clusters[clusters.length - 1];
    const anchor = last?.[0];
    if (!last || !anchor || spot.pct - anchor.pct > CLUSTER_YARDS) clusters.push([spot]);
    else last.push(spot);
  }

  const laid: DrivePlayDot[] = new Array(spots.length);
  for (const cluster of clusters) {
    const cols = Math.ceil(cluster.length / MAX_ROWS);
    cluster.forEach((spot, idx) => {
      const col = Math.floor(idx / MAX_ROWS);
      const row = idx % MAX_ROWS;
      const rowsHere = Math.min(MAX_ROWS, cluster.length - col * MAX_ROWS);
      const ySpan = (rowsHere - 1) * STEP;
      const xSpan = (cols - 1) * STEP;
      laid[spot.i] = {
        pct: spot.pct,
        x: col * STEP - xSpan / 2,
        y: row * STEP - ySpan / 2,
      };
    });
  }
  return laid.filter((dot): dot is DrivePlayDot => dot != null);
}
