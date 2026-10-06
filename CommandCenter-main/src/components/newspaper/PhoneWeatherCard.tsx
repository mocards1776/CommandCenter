import { usePhoneCardFit } from "@/hooks/usePhoneCardFit";
import {
  MARSHFIELD,
  clock,
  dayLength,
  hourLabel,
  moonPhase,
  uvWord,
  writtenForecast,
  type MarshfieldWeather,
  type WxHour,
} from "@/lib/newspaper-weather";
import { SkyIcon } from "@/components/newspaper/WeatherReport";
import { trimPhoneWeatherFit, type PhoneWeatherFit } from "@/lib/newspaper-phone-cards";

function weekday(date: string, style: "short" | "long" = "short"): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-US", { weekday: style, timeZone: "UTC" });
}

function MoonDisc({ lit, waxing, size = 36 }: { lit: number; waxing: boolean; size?: number }) {
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

function HourlyChart({ hours }: { hours: WxHour[] }) {
  if (hours.length < 4) return null;
  const W = 398;
  const H = 156;
  const top = 28;
  const base = 104;
  const temps = hours.map((h) => h.tempF);
  const lo = Math.min(...temps) - 2;
  const hi = Math.max(...temps) + 2;
  const x = (i: number) => 8 + (i * (W - 16)) / (hours.length - 1);
  const y = (t: number) => base - ((t - lo) / (hi - lo || 1)) * (base - top);
  const line = hours.map((h, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(h.tempF).toFixed(1)}`).join("");
  const area = `${line}L${x(hours.length - 1)} ${base}L${x(0)} ${base}Z`;
  const marks = hours.map((_, i) => i).filter((i) => i % 4 === 0);
  return (
    <figure className="tt-phone-hourly">
      <figcaption>Next 24 hours</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Hourly temperature and chance of rain">
        <path d={area} className="wx-area" />
        <path d={line} className="wx-line" />
        {hours.map((h, i) =>
          h.precipChance > 0 ? (
            <rect
              key={h.time}
              className="wx-pop"
              x={x(i) - 4}
              y={H - 22 - (h.precipChance / 100) * 22}
              width={8}
              height={(h.precipChance / 100) * 22}
            />
          ) : null,
        )}
        <line x1={0} x2={W} y1={H - 22} y2={H - 22} className="wx-base" />
        {marks.map((i) => (
          <g key={hours[i]!.time}>
            <circle cx={x(i)} cy={y(hours[i]!.tempF)} r={3.2} className="wx-dot" />
            <text x={x(i)} y={y(hours[i]!.tempF) - 9} className="wx-t">
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

/** Portrait iPhone weather card. Same Open-Meteo data as the paper; its own layout. */
export function PhoneWeatherCard({ weather }: { weather: MarshfieldWeather }) {
  const { current, days, hours, yesterday } = weather;
  const today = days[0];
  if (!today) return null;
  const moon = moonPhase(today.date);
  const week = days.slice(1, 8);
  const { ref, value } = usePhoneCardFit<PhoneWeatherFit>(
    { showAlmanac: true, showToday: true, days: week.length, showHourly: true },
    trimPhoneWeatherFit,
    weather.observedAt,
  );
  const outlook = week.slice(0, value.days);
  return (
    <article className="tt-phone-card tt-phone-wx" aria-label={`Weather for ${MARSHFIELD.place}`}>
      <div className="tt-phone-fit-body" ref={ref}>
      <header className="tt-phone-mast">
        <p className="tt-phone-kicker">Thompson Times</p>
        <h1>
          The Weather <span>· {MARSHFIELD.place}</span>
        </h1>
        <p className="tt-phone-dek">
          {MARSHFIELD.county} · Observed {clock(weather.observedAt)}
        </p>
      </header>

      <section className="tt-phone-now">
        <SkyIcon sky={current.sky} size={72} title={current.summary} />
        <div>
          <strong className="tt-phone-temp">{current.tempF}°</strong>
          <p className="tt-phone-sum">{current.summary}</p>
          <p className="tt-phone-hl">
            <b>{today.highF}°</b> / {today.lowF}°
          </p>
        </div>
      </section>

      {value.showToday ? (
        <p className="tt-phone-today">
          <span>Today</span> {writtenForecast(weather)}
        </p>
      ) : null}

      <dl className="tt-phone-facts">
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
          <dt>UV index</dt>
          <dd>
            {today.uv != null ? Math.round(today.uv) : "—"}
            <small> {uvWord(today.uv)}</small>
          </dd>
        </div>
      </dl>

      {value.showHourly ? <HourlyChart hours={hours} /> : null}

      {outlook.length ? (
        <section className="tt-phone-days" aria-label="Seven-day forecast">
          <h2>7-day forecast</h2>
          <ol>
            {outlook.map((d) => (
              <li key={d.date} className={d.precipChance >= 50 ? "wet" : undefined}>
                <span className="tt-phone-dayname">{weekday(d.date)}</span>
                <SkyIcon sky={d.sky} size={28} title={d.summary} />
                <span className="tt-phone-dayword">{d.summary}</span>
                <span className="tt-phone-dayhl">
                  <b>{d.highF}°</b>
                  <i>{d.lowF}°</i>
                </span>
                <span className="tt-phone-dayrain">{d.precipChance}%</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {value.showAlmanac ? (
        <section className="tt-phone-almanac" aria-label="Almanac">
          <h2>Almanac</h2>
          <div className="tt-phone-sunmoon">
            <div>
              <span>Sunrise</span>
              <b>{clock(today.sunrise)}</b>
            </div>
            <div>
              <span>Sunset</span>
              <b>{clock(today.sunset)}</b>
            </div>
            {dayLength(today.sunrise, today.sunset) ? (
              <div>
                <span>Daylight</span>
                <b>{dayLength(today.sunrise, today.sunset)}</b>
              </div>
            ) : null}
          </div>
          <div className="tt-phone-moon">
            <MoonDisc lit={moon.lit} waxing={moon.waxing} />
            <div>
              <b>{moon.name}</b>
              <em>{Math.round(moon.lit * 100)}% illuminated</em>
            </div>
          </div>
          {yesterday ? (
            <p className="tt-phone-yday">
              Yesterday <b>{yesterday.highF}°</b> / {yesterday.lowF}°
              <span>
                · Precip. {yesterday.precipIn > 0 ? `${yesterday.precipIn.toFixed(2)} in.` : "None"}
              </span>
            </p>
          ) : null}
        </section>
      ) : null}
      <p className="tt-phone-credit">Forecast data: Open-Meteo</p>
      </div>
    </article>
  );
}
