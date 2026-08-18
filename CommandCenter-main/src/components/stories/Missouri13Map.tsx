import type { DistrictMapSpec } from "@/lib/stories/types";
import {
  MO_COUNTIES,
  MO_MAP_VIEWBOX,
  PLAN_15,
  PLAN_48,
  PLAN_50,
} from "@/lib/stories/missouriCounties";

const FILLS: Record<number, string> = {
  1: "#8fa9c0",
  2: "#c4b07a",
  3: "#7f9b7a",
  4: "#b0896a",
  5: "#6f8aa8",
  6: "#c49a6c",
  7: "#8a9a6e",
  8: "#9a7a8e",
  9: "#6e8b8c",
  10: "#b39b7a",
  11: "#7a8fa3",
  12: "#a3906e",
  13: "#b42318",
  14: "#5f7d6a",
  15: "#8b6f58",
};

const PINS = [
  { label: "Marshfield", x: 315.4, y: 394.3, home: true },
  { label: "Springfield", x: 267.7, y: 396.9, home: false },
];

function planFor(spec: DistrictMapSpec): Record<string, number> {
  if (spec.plan === "53") return PLAN_15;
  if (spec.plan === "50") return PLAN_50;
  return PLAN_48;
}

function districtCenters(plan: Record<string, number>) {
  const acc: Record<number, { x: number; y: number; n: number }> = {};
  for (const c of MO_COUNTIES) {
    const d = plan[c.name];
    if (!d) continue;
    if (!acc[d]) acc[d] = { x: 0, y: 0, n: 0 };
    acc[d].x += c.x;
    acc[d].y += c.y;
    acc[d].n += 1;
  }
  return Object.entries(acc).map(([id, v]) => ({
    id: Number(id),
    x: v.x / v.n,
    y: v.y / v.n,
  }));
}

type Props = {
  maps: DistrictMapSpec[];
};

export default function Missouri13Map({ maps }: Props) {
  return (
    <div className="district-maps">
      {maps.map((m) => {
        const plan = planFor(m);
        const seats = m.plan === "53" ? 15 : 14;
        const centers = districtCenters(plan);
        return (
          <article key={m.id} className="district-map-card">
            <header>
              <h3>{m.title}</h3>
              <em>
                {m.congress} · {m.years}
              </em>
            </header>
            <svg
              viewBox={MO_MAP_VIEWBOX}
              role="img"
              aria-label={`${m.title} — Missouri counties filled by congressional district`}
              className="district-svg"
            >
              <rect width="720" height="560" fill="#d5deeb" />
              {MO_COUNTIES.map((c) => {
                const d = plan[c.name] ?? 0;
                const highlight = d === 13;
                return (
                  <path
                    key={c.name}
                    d={c.d}
                    fill={FILLS[d] ?? "#cfd6df"}
                    fillOpacity={highlight ? 0.95 : 0.72}
                    stroke={highlight ? "#7a140e" : "#143356"}
                    strokeWidth={highlight ? 1.35 : 0.55}
                  >
                    <title>
                      {c.name} County · District {d || "—"}
                    </title>
                  </path>
                );
              })}
              {centers.map((pt) => (
                <text
                  key={pt.id}
                  x={pt.x}
                  y={pt.y + 4}
                  textAnchor="middle"
                  fontSize={pt.id === 13 ? 13 : 10}
                  fontWeight={pt.id === 13 ? 800 : 700}
                  fill={pt.id === 13 ? "#3a0a08" : "#0b1f3a"}
                  fontFamily="Libre Franklin, system-ui, sans-serif"
                  style={{ pointerEvents: "none" }}
                >
                  {pt.id}
                </text>
              ))}
              {PINS.map((p) => (
                <g key={p.label}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={p.home ? 6.5 : 5}
                    fill={p.home ? "#f5f7fa" : "#c45c26"}
                    stroke={p.home ? "#b42318" : "#f5f7fa"}
                    strokeWidth="2"
                  />
                  <text
                    x={p.x + 8}
                    y={p.y - 8}
                    fontSize="10"
                    fontWeight={700}
                    fill="#0b1f3a"
                    fontFamily="Libre Franklin, system-ui, sans-serif"
                  >
                    {p.label}
                  </text>
                </g>
              ))}
              <text x="18" y="28" fontSize="11" fill="#5e6b7c" letterSpacing="0.12em">
                MISSOURI · {seats} DISTRICTS · COUNTIES FILLED
              </text>
            </svg>
            <ol className="district-legend" aria-label="District colors">
              {Array.from({ length: seats }, (_, i) => i + 1).map((d) => (
                <li key={d} className={d === 13 ? "is-home" : undefined}>
                  <i style={{ background: FILLS[d] }} />
                  {d}
                </li>
              ))}
            </ol>
            <p className="district-map-note">{m.note}</p>
            <ul className="district-counties">
              {m.counties.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </article>
        );
      })}
    </div>
  );
}
