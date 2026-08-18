import type { PresMapSpec } from "@/lib/stories/types";
import { MO_COUNTIES, MO_MAP_VIEWBOX } from "@/lib/stories/missouriCounties";

const FILL = {
  D: "#2c5a8c",
  R: "#b44a32",
  none: "#cfd6df",
};

const PINS = [
  { label: "Marshfield", x: 315.4, y: 394.3, home: true },
  { label: "Springfield", x: 267.7, y: 396.9, home: false },
];

function winnerOf(spec: PresMapSpec, name: string): "D" | "R" | null {
  if (spec.dem.includes(name)) return "D";
  if (spec.gop.includes(name)) return "R";
  return null;
}

type Props = {
  maps: PresMapSpec[];
};

export default function MissouriPresMap({ maps }: Props) {
  return (
    <div className="district-maps">
      {maps.map((m) => (
        <article key={m.id} className="district-map-card">
          <header>
            <h3>{m.title}</h3>
            <em>
              {m.year} · {m.subtitle}
            </em>
          </header>
          <svg
            viewBox={MO_MAP_VIEWBOX}
            role="img"
            aria-label={`${m.title} — Missouri counties by presidential plurality`}
            className="district-svg"
          >
            <rect width="720" height="560" fill="#d5deeb" />
            {MO_COUNTIES.map((c) => {
              const w = winnerOf(m, c.name);
              const home = c.name === "Webster";
              return (
                <path
                  key={c.name}
                  d={c.d}
                  fill={w ? FILL[w] : FILL.none}
                  fillOpacity={home ? 0.98 : 0.82}
                  stroke={home ? "#f5f7fa" : "#143356"}
                  strokeWidth={home ? 1.8 : 0.55}
                >
                  <title>
                    {c.name}
                    {c.name === "St. Louis City" ? "" : " County"} ·{" "}
                    {w === "D" ? m.demLabel : w === "R" ? m.gopLabel : "no plurality listed"}
                  </title>
                </path>
              );
            })}
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
              MISSOURI · PRESIDENT · COUNTY PLURALITY
            </text>
          </svg>
          <ol className="district-legend" aria-label="Party colors">
            <li>
              <i style={{ background: FILL.D }} />
              {m.demLabel}
            </li>
            <li>
              <i style={{ background: FILL.R }} />
              {m.gopLabel}
            </li>
          </ol>
          <p className="district-map-note">{m.note}</p>
        </article>
      ))}
    </div>
  );
}
