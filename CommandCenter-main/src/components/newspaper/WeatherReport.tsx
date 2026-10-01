import {
  MARSHFIELD,
  clock,
  dayLength,
  earForecast,
  hourLabel,
  moonPhase,
  uvWord,
  writtenForecast,
  type MarshfieldWeather,
  type Sky,
  type WxDay,
  type WxHour,
} from "@/lib/newspaper-weather";

const CLOUD = "M14 34H34A7 7 0 0 0 34 20A10 10 0 0 0 15 18A8 8 0 0 0 14 34Z";

function Sun({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const rays = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    const x1 = cx + Math.cos(a) * (r + 3);
    const y1 = cy + Math.sin(a) * (r + 3);
    const x2 = cx + Math.cos(a) * (r + 7);
    const y2 = cy + Math.sin(a) * (r + 7);
    return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />;
  });
  return (
    <g className="wx-sun">
      <circle cx={cx} cy={cy} r={r} />
      {rays}
    </g>
  );
}

function Crescent({ x = 0, y = 0, s = 1 }: { x?: number; y?: number; s?: number }) {
  return (
    <path
      className="wx-moon"
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M29 9A15 15 0 1 0 39 34A12 12 0 1 1 29 9Z"
    />
  );
}

function Cloud({ dy = 0, dark = false }: { dy?: number; dark?: boolean }) {
  return <path className={dark ? "wx-cloud dark" : "wx-cloud"} transform={`translate(0 ${dy})`} d={CLOUD} />;
}

/** Engraved-style sky glyphs, inked to sit in newsprint rather than an app. */
export function SkyIcon({ sky, size = 40, title }: { sky: Sky; size?: number; title?: string }) {
  let art: React.ReactNode;
  switch (sky) {
    case "sun":
      art = <Sun cx={24} cy={24} r={9} />;
      break;
    case "moon":
      art = <Crescent x={2} y={2} s={0.9} />;
      break;
    case "partly":
      art = (
        <>
          <Sun cx={18} cy={17} r={7} />
          <g transform="translate(4 4)">
            <Cloud />
          </g>
        </>
      );
      break;
    case "partly-night":
      art = (
        <>
          <Crescent x={-4} y={-4} s={0.62} />
          <g transform="translate(4 4)">
            <Cloud />
          </g>
        </>
      );
      break;
    case "cloud":
      art = (
        <>
          <g transform="translate(6 -4) scale(0.8)">
            <Cloud dark />
          </g>
          <g transform="translate(0 3)">
            <Cloud />
          </g>
        </>
      );
      break;
    case "fog":
      art = (
        <>
          <Cloud dy={-6} />
          <g className="wx-fog">
            <line x1={10} y1={34} x2={38} y2={34} />
            <line x1={14} y1={39} x2={34} y2={39} />
            <line x1={10} y1={44} x2={30} y2={44} />
          </g>
        </>
      );
      break;
    case "drizzle":
    case "rain":
    case "showers": {
      const drops = sky === "drizzle" ? [17, 25, 33] : [15, 22, 29, 36];
      art = (
        <>
          {sky === "showers" ? <Sun cx={33} cy={12} r={6} /> : null}
          <Cloud dy={-6} dark={sky === "rain"} />
          <g className="wx-rain">
            {drops.map((x, i) => (
              <line key={x} x1={x} y1={33 + (i % 2) * 3} x2={x - 3} y2={sky === "drizzle" ? 38 + (i % 2) * 3 : 42 + (i % 2) * 3} />
            ))}
          </g>
        </>
      );
      break;
    }
    case "storm":
      art = (
        <>
          <Cloud dy={-6} dark />
          <path className="wx-bolt" d="M25 29L19 39H24L21 47L31 35H26L29 29Z" />
          <g className="wx-rain">
            <line x1={14} y1={33} x2={11} y2={40} />
            <line x1={36} y1={33} x2={33} y2={40} />
          </g>
        </>
      );
      break;
    case "snow":
      art = (
        <>
          <Cloud dy={-6} />
          <g className="wx-snow">
            {[
              [16, 38],
              [25, 43],
              [34, 38],
            ].map(([x, y]) => (
              <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
                <line x1={-3.5} y1={0} x2={3.5} y2={0} />
                <line x1={-1.8} y1={-3} x2={1.8} y2={3} />
                <line x1={-1.8} y1={3} x2={1.8} y2={-3} />
              </g>
            ))}
          </g>
        </>
      );
      break;
  }
  return (
    <svg className="wx-icon" viewBox="0 0 48 48" width={size} height={size} role="img" aria-label={title ?? sky}>
      {art}
    </svg>
  );
}

/** Lit portion of the moon drawn from the phase, not picked from a set. */
function MoonDisc({ lit, waxing, size = 44 }: { lit: number; waxing: boolean; size?: number }) {
  const r = 20;
  const c = 24;
  const rx = Math.abs(1 - 2 * lit) * r;
  const outer = waxing ? 1 : 0;
  const inner = waxing ? (lit < 0.5 ? 0 : 1) : lit < 0.5 ? 1 : 0;
  const d = `M${c} ${c - r}A${r} ${r} 0 0 ${outer} ${c} ${c + r}A${rx} ${r} 0 0 ${inner} ${c} ${c - r}Z`;
  return (
    <svg className="wx-moondisc" viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <circle cx={c} cy={c} r={r} className="dark" />
      {lit > 0.02 ? <path d={d} className="lit" /> : null}
      <circle cx={c} cy={c} r={r} className="ring" />
    </svg>
  );
}

function weekday(date: string, style: "short" | "long" = "short"): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-US", { weekday: style, timeZone: "UTC" });
}

function monthDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function HourlyChart({ hours }: { hours: WxHour[] }) {
  if (hours.length < 4) return null;
  const W = 600;
  const H = 168;
  const top = 34;
  const base = 112;
  const temps = hours.map((h) => h.tempF);
  const lo = Math.min(...temps) - 2;
  const hi = Math.max(...temps) + 2;
  const x = (i: number) => 18 + (i * (W - 36)) / (hours.length - 1);
  const y = (t: number) => base - ((t - lo) / (hi - lo || 1)) * (base - top);
  const line = hours.map((h, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(h.tempF).toFixed(1)}`).join("");
  const area = `${line}L${x(hours.length - 1)} ${base}L${x(0)} ${base}Z`;
  const marks = hours.map((_, i) => i).filter((i) => i % 3 === 0);
  return (
    <figure className="wx-hourly">
      <figcaption>Next 24 hours</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Hourly temperature and chance of rain">
        <path d={area} className="wx-area" />
        <path d={line} className="wx-line" />
        {hours.map((h, i) =>
          h.precipChance > 0 ? (
            <rect
              key={h.time}
              className="wx-pop"
              x={x(i) - 6}
              y={H - 22 - (h.precipChance / 100) * 26}
              width={12}
              height={(h.precipChance / 100) * 26}
            />
          ) : null,
        )}
        <line x1={0} x2={W} y1={H - 22} y2={H - 22} className="wx-base" />
        {marks.map((i) => (
          <g key={hours[i]!.time}>
            <circle cx={x(i)} cy={y(hours[i]!.tempF)} r={3.5} className="wx-dot" />
            <text x={x(i)} y={y(hours[i]!.tempF) - 10} className="wx-t">
              {hours[i]!.tempF}°
            </text>
            <text x={x(i)} y={H - 6} className="wx-h">
              {hourLabel(hours[i]!.time)}
            </text>
          </g>
        ))}
      </svg>
      <p className="wx-key">
        <i className="wx-key-line" /> Temperature <i className="wx-key-pop" /> Chance of rain
      </p>
    </figure>
  );
}

function TenDayChart({ days }: { days: WxDay[] }) {
  if (days.length < 3) return null;
  const W = 600;
  const H = 190;
  const top = 26;
  const bottom = 150;
  const lo = Math.min(...days.map((d) => d.lowF)) - 3;
  const hi = Math.max(...days.map((d) => d.highF)) + 3;
  const step = (W - 40) / (days.length - 1);
  const x = (i: number) => 20 + i * step;
  const y = (t: number) => bottom - ((t - lo) / (hi - lo || 1)) * (bottom - top);
  const path = (k: "highF" | "lowF") => days.map((d, i) => `${i ? "L" : "M"}${x(i)} ${y(d[k])}`).join("");
  const band =
    days.map((d, i) => `${i ? "L" : "M"}${x(i)} ${y(d.highF)}`).join("") +
    [...days].reverse().map((d, j) => `L${x(days.length - 1 - j)} ${y(d.lowF)}`).join("") +
    "Z";
  return (
    <figure className="wx-tenday">
      <figcaption>Ten-day temperatures</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Ten-day highs and lows">
        <path d={band} className="wx-band" />
        <path d={path("highF")} className="wx-hi" />
        <path d={path("lowF")} className="wx-lo" />
        {days.map((d, i) => (
          <g key={d.date}>
            <line x1={x(i)} x2={x(i)} y1={y(d.highF)} y2={y(d.lowF)} className="wx-tick" />
            <text x={x(i)} y={y(d.highF) - 8} className="wx-t hi">
              {d.highF}°
            </text>
            <text x={x(i)} y={y(d.lowF) + 16} className="wx-t lo">
              {d.lowF}°
            </text>
            <text x={x(i)} y={H - 8} className="wx-h">
              {i === 0 ? "Today" : weekday(d.date)}
            </text>
          </g>
        ))}
      </svg>
    </figure>
  );
}

export function WeatherReport({ weather }: { weather: MarshfieldWeather | null | undefined }) {
  if (!weather || !weather.days.length) return null;
  const { current, days, hours, yesterday } = weather;
  const today = days[0]!;
  const moon = moonPhase(today.date);
  const outlook = days.slice(1, 8);
  return (
    <section className="wx" aria-label={`Weather for ${MARSHFIELD.place}`}>
      <header className="wx-head">
        <h2>
          <span>The</span> Weather
        </h2>
        <p>
          <b>{MARSHFIELD.place}</b> · {MARSHFIELD.county} · Observed {clock(weather.observedAt)}
        </p>
      </header>

      <div className="wx-top">
        <div className="wx-now">
          <SkyIcon sky={current.sky} size={112} title={current.summary} />
          <div className="wx-now-read">
            <span className="wx-kicker">Right now</span>
            <strong className="wx-temp">{current.tempF}°</strong>
            <span className="wx-sum">{current.summary}</span>
            <span className="wx-hl">
              <b>{today.highF}°</b> / {today.lowF}°
            </span>
          </div>
          <p className="wx-written">
            <span className="wx-dropcap">Today:</span> {writtenForecast(weather)}
          </p>
          <dl className="wx-facts">
            <div>
              <dt>Feels like</dt>
              <dd>{current.feelsLikeF}°</dd>
            </div>
            <div>
              <dt>Wind</dt>
              <dd>
                {current.windFrom} {current.windMph}
                <small> mph</small>
              </dd>
            </div>
            <div>
              <dt>Humidity</dt>
              <dd>{current.humidity}%</dd>
            </div>
            <div>
              <dt>Dew point</dt>
              <dd>{current.dewPointF}°</dd>
            </div>
            <div>
              <dt>Barometer</dt>
              <dd>
                {current.pressureIn.toFixed(2)}
                <small> in</small>
              </dd>
            </div>
            <div>
              <dt>UV index</dt>
              <dd>
                {today.uv != null ? Math.round(today.uv) : "—"}
                <small> {uvWord(today.uv)}</small>
              </dd>
            </div>
          </dl>
        </div>
        <HourlyChart hours={hours} />
      </div>

      {outlook.length ? (
        <ol className="wx-outlook" style={{ ["--n" as string]: String(outlook.length) }}>
          {outlook.map((d) => (
            <li key={d.date} className={d.precipChance >= 50 ? "wet" : undefined}>
              <span className="wx-day">{weekday(d.date)}</span>
              <span className="wx-date">{monthDay(d.date)}</span>
              <SkyIcon sky={d.sky} size={46} title={d.summary} />
              <span className="wx-word">{d.summary}</span>
              <span className="wx-range">
                <b>{d.highF}°</b>
                <i>{d.lowF}°</i>
              </span>
              <span className="wx-pct">{d.precipChance}% rain</span>
            </li>
          ))}
        </ol>
      ) : null}

      <div className="wx-bottom">
        <TenDayChart days={days} />
        <aside className="wx-almanac">
          <h3>Almanac</h3>
          <div className="wx-sunline">
            <svg viewBox="0 0 120 44" aria-hidden="true">
              <path d="M8 40A52 52 0 0 1 112 40" className="arc" />
              <line x1={0} x2={120} y1={40} y2={40} className="hz" />
              <circle cx={60} cy={14} r={6} className="sun" />
            </svg>
            <div>
              <span>
                Sunrise <b>{clock(today.sunrise)}</b>
              </span>
              <span>
                Sunset <b>{clock(today.sunset)}</b>
              </span>
              {dayLength(today.sunrise, today.sunset) ? <em>{dayLength(today.sunrise, today.sunset)} of daylight</em> : null}
            </div>
          </div>
          <div className="wx-moonline">
            <MoonDisc lit={moon.lit} waxing={moon.waxing} />
            <div>
              <b>{moon.name}</b>
              <em>{Math.round(moon.lit * 100)}% illuminated</em>
            </div>
          </div>
          {yesterday ? (
            <table className="wx-yday">
              <caption>Yesterday in Marshfield</caption>
              <tbody>
                <tr>
                  <th>High</th>
                  <td>{yesterday.highF}°</td>
                  <th>Low</th>
                  <td>{yesterday.lowF}°</td>
                </tr>
                <tr>
                  <th>Precip.</th>
                  <td colSpan={3}>{yesterday.precipIn > 0 ? `${yesterday.precipIn.toFixed(2)} in.` : "None"}</td>
                </tr>
              </tbody>
            </table>
          ) : null}
        </aside>
      </div>
      <p className="wx-credit">Forecast data: Open-Meteo</p>
    </section>
  );
}

/** Masthead ear: the day's forecast in a sentence, like the front of a city paper. */
export function WeatherEar({
  weather,
  label,
  folio,
  onOpen,
}: {
  weather: MarshfieldWeather | null | undefined;
  label: string;
  folio: string | null;
  onOpen?: () => void;
}) {
  if (!weather?.days.length) return null;
  return (
    <button
      type="button"
      className="wsj-ear right wx-ear"
      onClick={onOpen}
      disabled={!folio}
      title={folio ? `Full weather report, page ${folio}` : undefined}
    >
      <strong>{label}</strong>
      <span className="wx-ear-row">
        <SkyIcon sky={weather.current.sky} size={34} title={weather.current.summary} />
        <span className="wx-ear-now">
          <b>{weather.current.tempF}°</b>
          <i>Marshfield</i>
        </span>
      </span>
      <span className="wx-ear-text">{earForecast(weather)}</span>
      {folio ? <span className="wx-ear-turn">Full report, {folio}</span> : null}
    </button>
  );
}
