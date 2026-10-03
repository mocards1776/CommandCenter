import { Link } from "react-router-dom";
import { type NhlIcePlayer, type NhlIceState, type NhlScoreSide } from "@/lib/nhl";
import { cn } from "@/lib/utils";

/**
 * Ice Tracker-style top-down rink. Coordinates are ESPN's: feet from center ice,
 * x ∈ ±100 (goal lines at ±89), y ∈ ±42.5. Player spots are estimates — ESPN
 * and NHL only publish who is on the ice, not where — built from position
 * templates that slide toward the zone of the latest located play.
 */

const HALF_L = 100;
const HALF_W = 42.5;
const GOAL_X = 89;
const CREASE_X = 85.5;

type Slot = "C" | "LW" | "RW" | "LD" | "RD" | "X1" | "X2";
/** [attack depth toward the net this team shoots at, lateral (+ = left of attack)]. */
type Spot = [number, number];

const TEMPLATES: Record<"offense" | "neutral" | "defense", Record<Slot, Spot>> = {
  offense: { C: [62, 4], LW: [70, 22], RW: [66, -21], LD: [33, 18], RD: [33, -17], X1: [50, -4], X2: [78, 2] },
  neutral: { C: [8, 3], LW: [14, 25], RW: [14, -25], LD: [-24, 13], RD: [-24, -13], X1: [-4, 0], X2: [24, 0] },
  defense: { C: [-60, 6], LW: [-42, 27], RW: [-42, -27], LD: [-74, 13], RD: [-72, -14], X1: [-56, -6], X2: [-48, 0] },
};

const FORWARD_ORDER: Slot[] = ["C", "LW", "RW", "X1", "X2", "LD", "RD"];
const DEFENSE_ORDER: Slot[] = ["LD", "RD", "X1", "X2", "C", "LW", "RW"];

type Placed = { player: NhlIcePlayer; side: "away" | "home"; x: number; y: number; fixed: boolean };

function assignSlots(skaters: NhlIcePlayer[]): { player: NhlIcePlayer; slot: Slot }[] {
  const taken = new Map<Slot, NhlIcePlayer>();
  const rest: NhlIcePlayer[] = [];
  for (const p of skaters) {
    const pos = (p.position ?? "").toUpperCase();
    const want: Slot[] = pos === "D" ? ["LD", "RD"] : pos === "C" || pos === "LW" || pos === "RW" ? [pos] : [];
    const slot = want.find((s) => !taken.has(s));
    if (slot) taken.set(slot, p);
    else rest.push(p);
  }
  for (const p of rest) {
    const order = (p.position ?? "").toUpperCase() === "D" ? DEFENSE_ORDER : FORWARD_ORDER;
    const slot = order.find((s) => !taken.has(s));
    if (slot) taken.set(slot, p);
  }
  return [...taken].map(([slot, player]) => ({ player, slot }));
}

function lerp(a: Spot, b: Spot, t: number): Spot {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function placeTeam(
  players: NhlIcePlayer[],
  side: "away" | "home",
  attacksRight: boolean,
  puckX: number,
): Placed[] {
  const dir = attacksRight ? 1 : -1;
  const depth = Math.max(-0.85, Math.min(0.85, (puckX * dir) / 70));
  const template = depth >= 0 ? TEMPLATES.offense : TEMPLATES.defense;
  const out: Placed[] = [];
  const goalies = players.filter((p) => (p.position ?? "").toUpperCase() === "G");
  const skaters = players.filter((p) => (p.position ?? "").toUpperCase() !== "G");
  goalies.forEach((player, i) => {
    out.push({ player, side, x: -dir * CREASE_X, y: i * 8, fixed: true });
  });
  for (const { player, slot } of assignSlots(skaters)) {
    const [a, s] = lerp(TEMPLATES.neutral[slot], template[slot], Math.abs(depth));
    // Facing +x, the attacker's left is screen-up (negative y).
    out.push({ player, side, x: a * dir, y: -s * dir, fixed: false });
  }
  return out;
}

/**
 * Nudge overlapping markers apart. Each marker is a headshot over a name pill,
 * ≈ 30 × 25 ft at phone width, so separate boxes along the shallower overlap.
 */
function relax(points: Placed[]): Placed[] {
  const W = 30;
  const H = 25;
  const pts = points.map((p) => ({ ...p }));
  for (let iter = 0; iter < 200; iter++) {
    let moved = false;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i]!;
        const b = pts[j]!;
        if (a.fixed && b.fixed) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const penX = W - Math.abs(dx);
        const penY = H - Math.abs(dy);
        if (penX <= 0 || penY <= 0) continue;
        // The rink is 200 × 85, so sideways has far more room than up/down.
        const alongX = penX / W < (penY / H) * 1.8;
        const sign = (alongX ? dx : dy) >= 0 ? 1 : -1;
        const step = ((alongX ? penX : penY) / 2 + 0.2) * sign;
        const share = a.fixed || b.fixed ? 2 : 1;
        if (!a.fixed) {
          if (alongX) a.x -= step * share;
          else a.y -= step * share;
        }
        if (!b.fixed) {
          if (alongX) b.x += step * share;
          else b.y += step * share;
        }
        moved = true;
      }
    }
    for (const p of pts) {
      if (p.fixed) continue;
      p.x = Math.max(-GOAL_X + 4, Math.min(GOAL_X - 4, p.x));
      p.y = Math.max(-HALF_W + 10, Math.min(HALF_W - 12, p.y));
    }
    if (!moved) break;
  }
  return pts;
}

const pctX = (x: number) => `${((x + HALF_L) / (HALF_L * 2)) * 100}%`;
const pctY = (y: number) => `${((y + HALF_W) / (HALF_W * 2)) * 100}%`;

function RinkMarkings() {
  const red = "#c8102e";
  const blue = "#1d4fb8";
  const dot = (cx: number, cy: number) => <circle key={`${cx}:${cy}`} cx={cx} cy={cy} r={1} fill={red} />;
  const endCircle = (cx: number, cy: number) => (
    <g key={`c${cx}:${cy}`}>
      <circle cx={cx} cy={cy} r={15} fill="none" stroke={red} strokeWidth={0.45} />
      {dot(cx, cy)}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sy) => (
          <path
            key={`${sx}${sy}`}
            d={`M${cx + sx * 2} ${cy + sy * 15} v${sy * 2.6}`}
            stroke={red}
            strokeWidth={0.45}
          />
        )),
      )}
    </g>
  );
  const net = (side: 1 | -1) => (
    <g key={`net${side}`}>
      <path
        d={`M${GOAL_X} -6 A6 6 0 0 0 ${GOAL_X} 6 Z`}
        transform={side === 1 ? undefined : "scale(-1 1)"}
        fill="#9fc9f0"
        fillOpacity={0.55}
        stroke={red}
        strokeWidth={0.35}
      />
      <rect
        x={side === 1 ? GOAL_X : -GOAL_X - 3.3}
        y={-3}
        width={3.3}
        height={6}
        rx={1.2}
        fill="none"
        stroke="#64748b"
        strokeWidth={0.5}
      />
      <path
        d={`M${side * GOAL_X} -11 L${side * 100} -14 M${side * GOAL_X} 11 L${side * 100} 14`}
        stroke={red}
        strokeWidth={0.3}
      />
    </g>
  );
  return (
    <>
      <rect x={-HALF_L} y={-HALF_W} width={200} height={85} rx={28} fill="#f5f8fc" />
      {[-1, 1].map((s) => (
        <path key={`gl${s}`} d={`M${s * GOAL_X} -36.7 V36.7`} stroke={red} strokeWidth={0.35} />
      ))}
      <rect x={-26} y={-HALF_W} width={1} height={85} fill={blue} />
      <rect x={25} y={-HALF_W} width={1} height={85} fill={blue} />
      <rect x={-0.5} y={-HALF_W} width={1} height={85} fill={red} />
      <circle cx={0} cy={0} r={15} fill="none" stroke={blue} strokeWidth={0.45} />
      <circle cx={0} cy={0} r={0.6} fill={blue} />
      {[-20, 20].flatMap((cx) => [-22, 22].map((cy) => dot(cx, cy)))}
      {[-69, 69].flatMap((cx) => [-22, 22].map((cy) => endCircle(cx, cy)))}
      {net(1)}
      {net(-1)}
      <rect
        x={-HALF_L}
        y={-HALF_W}
        width={200}
        height={85}
        rx={28}
        fill="none"
        stroke="#9aa6b8"
        strokeWidth={1}
      />
    </>
  );
}

function Marker({ p, color }: { p: Placed; color: string }) {
  const pos = (p.player.position ?? "").toUpperCase();
  return (
    <Link
      to={`/sports/nhl/player/${p.player.id}`}
      title={`${p.player.name}${pos ? ` · ${pos}` : ""}`}
      className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
      style={{ left: pctX(p.x), top: pctY(p.y) }}
    >
      <span className="relative">
        <span
          className="relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border-2 shadow-[0_2px_6px_rgba(0,0,0,0.35)] sm:h-10 sm:w-10"
          style={{ borderColor: color, background: color }}
        >
          <span className="absolute text-[9px] font-bold text-white sm:text-[11px]">{p.player.jersey ?? pos}</span>
          {p.player.headshot ? (
            <img
              src={p.player.headshot}
              alt=""
              loading="lazy"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
              className="relative h-full w-full bg-[#dfe6f2] object-cover object-top"
            />
          ) : null}
        </span>
        {pos ? (
          <span
            className="absolute -left-1.5 -top-1 min-w-[14px] rounded-full px-[3px] text-center text-[7.5px] font-bold leading-[12px] text-white ring-1 ring-white/80 sm:text-[9px] sm:leading-[14px]"
            style={{ background: color }}
          >
            {pos}
          </span>
        ) : null}
      </span>
      <span className="mt-0.5 max-w-[3.9rem] truncate whitespace-nowrap rounded-sm bg-[#0a1220]/85 px-1 text-[8px] leading-[12px] text-white sm:max-w-[6.5rem] sm:text-[10px] sm:leading-[15px]">
        {p.player.lastName}
      </span>
    </Link>
  );
}

const SOURCE_LABEL: Record<NhlIceState["source"], string> = {
  live: "On ice",
  lineup: "Top line (est.)",
  goalies: "Projected goalies",
};

export default function NhlIceRink({
  ice,
  away,
  home,
  live,
  final,
  statusText,
}: {
  ice: NhlIceState;
  away: NhlScoreSide;
  home: NhlScoreSide;
  live: boolean;
  final: boolean;
  statusText: string;
}) {
  const homeRight = ice.homeAttacksRight;
  // Only a live snapshot is anchored to the latest play; otherwise show a centre-ice lineup.
  const tracking = live && ice.source === "live" ? ice.lastEvent : null;
  const puckX = tracking?.x ?? 0;
  const placed = relax([
    ...placeTeam(ice.away, "away", !homeRight, puckX),
    ...placeTeam(ice.home, "home", homeRight, puckX),
  ]);
  const color = { away: `#${away.color}`, home: `#${home.color}` };
  const leftTeam = homeRight ? home : away;
  const rightTeam = homeRight ? away : home;
  const skaters = (list: NhlIcePlayer[]) => list.filter((p) => (p.position ?? "").toUpperCase() !== "G").length;
  const strength =
    ice.source === "live" ? `${skaters(ice.away)} on ${skaters(ice.home)}` : null;
  const sourceLabel = ice.source === "live" && final ? "Final on ice" : SOURCE_LABEL[ice.source];

  return (
    <section className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]">
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-2.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e8e4d9]">Ice tracker</h3>
        <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-[#8b93a7]">
          {live ? <span className="bg-alert h-1.5 w-1.5 animate-pulse rounded-full" /> : null}
          <span>{sourceLabel}</span>
          {strength ? <span className="text-cream tabular-nums">{strength}</span> : null}
          {live || final ? <span className="text-chalk tabular-nums normal-case">{statusText}</span> : null}
        </p>
      </div>

      <div className="px-2 pt-3 sm:px-4 sm:pt-4">
        <div className="relative aspect-[200/85] w-full">
          <svg
            viewBox={`${-HALF_L} ${-HALF_W} 200 85`}
            className="absolute inset-0 h-full w-full"
            role="img"
            aria-label={`Rink: ${leftTeam.abbrev} defends left, ${rightTeam.abbrev} defends right`}
          >
            <RinkMarkings />
          </svg>
          {home.logo ? (
            <img
              src={home.logo}
              alt=""
              className="pointer-events-none absolute left-1/2 top-1/2 h-[62%] -translate-x-1/2 -translate-y-1/2 object-contain opacity-[0.2]"
            />
          ) : null}
          {tracking ? (
            <span
              title={tracking.type ? `Last play: ${tracking.type}` : "Last play"}
              className="absolute z-[5] h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0b0f17] ring-2 ring-[#0b0f17]/25 sm:h-2.5 sm:w-2.5"
              style={{ left: pctX(tracking.x), top: pctY(-tracking.y) }}
            >
              <span className="absolute inset-0 animate-ping rounded-full bg-[#0b0f17]/50" />
            </span>
          ) : null}
          {placed.map((p) => (
            <Marker key={`${p.side}-${p.player.id}`} p={p} color={color[p.side]} />
          ))}
        </div>
        <div className="flex items-center justify-between gap-2 px-1 py-2 text-[10px] uppercase tracking-[0.12em] text-[#8b93a7]">
          <span className="flex items-center gap-1.5">
            {leftTeam.logo ? <img src={leftTeam.logo} alt="" className="h-4 w-4 object-contain" /> : null}
            {leftTeam.abbrev} net
          </span>
          {tracking?.type ? (
            <span className="flex items-center gap-1.5 normal-case tracking-normal text-[#a8b0c2]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#e8e4d9]" />
              {tracking.type}
            </span>
          ) : null}
          <span className="flex items-center gap-1.5">
            {rightTeam.abbrev} net
            {rightTeam.logo ? <img src={rightTeam.logo} alt="" className="h-4 w-4 object-contain" /> : null}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-3 border-t border-white/[0.06] px-3 py-3 sm:px-4">
        {(["away", "home"] as const).map((side) => {
          const team = side === "away" ? away : home;
          return (
            <ul key={side} className={cn("min-w-0 space-y-1.5", side === "home" && "text-right")}>
              <li
                className={cn(
                  "mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8b93a7]",
                  side === "home" && "flex-row-reverse",
                )}
              >
                {team.logo ? <img src={team.logo} alt="" className="h-4 w-4 object-contain" /> : null}
                {team.abbrev}
              </li>
              {ice[side].map((p) => (
                <li
                  key={p.id}
                  className={cn("flex items-center gap-1.5 text-[11.5px]", side === "home" && "flex-row-reverse")}
                >
                  <span className="numeral w-5 shrink-0 text-[10px] text-[#8b93a7]">{p.position ?? ""}</span>
                  <Link to={`/sports/nhl/player/${p.id}`} className="text-cream truncate hover:underline">
                    {p.jersey ? <span className="text-chalk numeral">#{p.jersey} </span> : null}
                    {p.name}
                  </Link>
                </li>
              ))}
            </ul>
          );
        })}
      </div>
    </section>
  );
}
