import type { DistrictMapSpec } from "@/lib/stories/types";

const STATE_PATH =
  "M377.2 12.6 L386.9 12.0 L405.7 34.6 L415.9 38.3 L407.7 54.2 L408.8 76.9 L420.5 111.2 L448.9 139.9 L480.0 163.8 L486.1 200.5 L493.2 207.3 L503.9 196.9 L524.2 201.8 L537.5 209.7 L528.3 223.2 L530.8 233.6 L515.1 262.3 L514.6 280.1 L542.0 302.7 L552.2 317.4 L562.4 315.0 L592.4 338.9 L592.4 356.0 L600.0 377.4 L592.4 384.8 L613.2 416.6 L628.0 417.8 L620.4 463.1 L606.6 458.2 L601.5 472.3 L595.4 472.3 L590.4 472.3 L590.9 499.8 L572.6 528.0 L512.5 528.0 L527.3 507.2 L541.5 493.7 L533.4 472.3 L132.0 471.7 L118.8 471.7 L118.8 416.0 L119.3 174.8 L99.5 169.3 L84.7 143.0 L73.0 132.0 L93.9 99.5 L63.9 91.0 L54.7 80.6 L31.8 51.2 L12.0 15.1 L117.3 16.9 L245.0 15.7 L377.2 12.6 Z";

/** Projected county seats on the same 640×540 frame as STATE_PATH. */
const COUNTY_DOTS: { name: string; x: number; y: number }[] = [
  { name: "Barry", x: 191.8, y: 448.4 },
  { name: "Barton", x: 144.5, y: 360.1 },
  { name: "Bates", x: 144.5, y: 275.2 },
  { name: "Cedar", x: 189.1, y: 335.5 },
  { name: "Dade", x: 190.0, y: 368.0 },
  { name: "Greene", x: 237.4, y: 387.0 },
  { name: "Henry", x: 197.4, y: 260.7 },
  { name: "Jasper", x: 144.5, y: 393.7 },
  { name: "Lawrence", x: 191.8, y: 403.7 },
  { name: "McDonald", x: 143.5, y: 458.5 },
  { name: "Newton", x: 145.4, y: 426.1 },
  { name: "St. Clair", x: 196.5, y: 299.8 },
  { name: "Vernon", x: 144.5, y: 322.1 },
  { name: "Webster", x: 280.1, y: 384.7 },
];

const PINS = [
  { label: "Marshfield", x: 277.6, y: 378.1, home: true },
  { label: "Springfield", x: 241.8, y: 392.0, home: false },
];

type Props = {
  maps: DistrictMapSpec[];
};

export default function Missouri13Map({ maps }: Props) {
  return (
    <div className="district-maps">
      {maps.map((m) => (
        <article key={m.id} className="district-map-card">
          <header>
            <h3>{m.title}</h3>
            <em>
              {m.congress} · {m.years}
            </em>
          </header>
          <svg
            viewBox="0 0 640 540"
            role="img"
            aria-label={`${m.title} county map of Missouri`}
            className="district-svg"
          >
            <rect width="640" height="540" fill="#d5deeb" />
            <path d={STATE_PATH} fill="#eef2f6" stroke="#143356" strokeWidth="2.2" />
            <path
              d="M120 248 L120 470 L318 470 L318 248 Z"
              fill="rgba(180,35,24,0.18)"
              stroke="rgba(180,35,24,0.45)"
              strokeWidth="1.5"
            />
            {COUNTY_DOTS.map((c) => (
              <g key={c.name}>
                <circle cx={c.x} cy={c.y} r="5.5" fill="#143356" stroke="#f5f7fa" strokeWidth="1.4" />
                <text
                  x={c.x + 8}
                  y={c.y + 3.5}
                  fontSize="9"
                  fill="#0b1f3a"
                  fontFamily="Libre Franklin, system-ui, sans-serif"
                >
                  {c.name}
                </text>
              </g>
            ))}
            {PINS.map((p) => (
              <g key={p.label}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={p.home ? 8 : 6}
                  fill={p.home ? "#b42318" : "#c45c26"}
                  stroke="#f5f7fa"
                  strokeWidth="2"
                />
              </g>
            ))}
            <text x="24" y="28" fontSize="11" fill="#5e6b7c" letterSpacing="0.12em">
              MISSOURI · 13TH DISTRICT COUNTIES
            </text>
          </svg>
          <p className="district-map-note">{m.note}</p>
          <ul className="district-counties">
            {m.counties.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}
