import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Loader2, Trophy } from "lucide-react";
import { useSwipeBack } from "@/hooks/useSwipeBack";
import { fetchNhlCoachProfile, liftTeamColor, type NhlCoachRecordLine } from "@/lib/nhl";
import { cn, formatSportsDateLong } from "@/lib/utils";

function wlo(line: NhlCoachRecordLine | null | undefined, withOt = true): string {
  if (!line) return "—";
  return withOt ? `${line.wins}-${line.losses}-${line.otLosses}` : `${line.wins}-${line.losses}`;
}

function pct(v: number | null | undefined): string {
  return v == null ? "—" : v.toFixed(3).replace(/^0/, "");
}

export default function NhlCoachPage() {
  const { coachId } = useParams<{ coachId: string }>();
  const [params] = useSearchParams();
  const teamHint = params.get("team");
  const navigate = useNavigate();
  const swipeRef = useSwipeBack(() => navigate(-1));

  const detail = useQuery({
    queryKey: ["nhl-coach-v1", coachId, teamHint],
    queryFn: () => fetchNhlCoachProfile(coachId!, teamHint),
    enabled: Boolean(coachId),
    staleTime: 600_000,
  });

  if (detail.isPending) {
    return (
      <div className="text-chalk flex min-h-[50vh] items-center justify-center gap-2">
        <Loader2 size={18} className="animate-spin" />
        Loading coach…
      </div>
    );
  }

  if (detail.isError || !detail.data) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-7">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-chalk hover:text-cream inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.14em]"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <p className="text-alert text-[13px]">
          {detail.error instanceof Error ? detail.error.message : "Coach unavailable"}
        </p>
      </div>
    );
  }

  const c = detail.data;
  const team = c.team;
  const accent = liftTeamColor(`#${team?.color ?? "002f87"}`);
  const career = c.career;
  const current = c.stints.find((s) => s.current);

  return (
    <div ref={swipeRef} className="mx-auto max-w-3xl space-y-6 p-4 md:p-7">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-chalk hover:text-cream inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.14em]"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <Link
          to="/sports/nhl?solo=1"
          className="text-chalk-dim hover:text-cream text-[11px] uppercase tracking-[0.14em]"
        >
          NHL board
        </Link>
      </div>

      <article className="relative overflow-hidden rounded-2xl border border-white/[0.1]">
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(135deg, #081228 0%, ${accent}55 55%, #0a1730 100%)` }}
        />
        {team?.logo ? (
          <img
            src={team.logo}
            alt=""
            className="pointer-events-none absolute -right-8 -top-6 h-56 w-56 object-contain opacity-[0.08]"
          />
        ) : null}
        <div className="relative z-10 flex flex-col gap-5 p-5 sm:flex-row sm:items-start">
          {c.image ? (
            <img
              src={c.image}
              alt=""
              className="mx-auto h-[128px] w-[128px] rounded-xl bg-[#0c1a2e] object-cover object-[center_15%] shadow-xl ring-2 ring-white/20 sm:mx-0"
            />
          ) : team?.logo ? (
            <div className="mx-auto flex h-[128px] w-[128px] shrink-0 items-center justify-center rounded-xl bg-white/[0.06] shadow-xl ring-2 ring-white/15 sm:mx-0">
              <img src={team.logo} alt="" className="h-24 w-24 object-contain" />
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                {team ? (
                  <div className="mb-2 flex items-center gap-2">
                    {team.logo ? <img src={team.logo} alt="" className="h-6 w-6 object-contain" /> : null}
                    <Link
                      to={`/sports/nhl/team/${team.espnId}`}
                      className="text-[13px] font-medium text-white/80 transition hover:text-white"
                    >
                      {team.name}
                    </Link>
                  </div>
                ) : null}
                <h1 className="font-display text-[34px] leading-[0.95] text-white sm:text-[42px]">{c.name}</h1>
                <p className="mt-1.5 text-[13px] text-white/75">
                  Head coach
                  {team ? ` · ${team.abbrev}` : ""}
                  {current ? ` · since ${current.startSeason}` : ""}
                  {team?.standing ? ` · ${team.standing}` : ""}
                </p>
              </div>
              {c.age != null && (
                <div className="shrink-0 rounded-md border border-white/25 bg-black/35 px-3 py-2 text-center">
                  <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/60">Age</p>
                  <p className="numeral text-[28px] leading-none text-white">{c.age}</p>
                </div>
              )}
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-2.5 text-[12.5px] sm:grid-cols-4">
              <Meta label="This season" value={team?.record ?? "—"} />
              <Meta label="Points" value={team?.points != null ? String(team.points) : "—"} />
              <Meta label="Career" value={wlo(career?.regular)} />
              <Meta label="Point %" value={pct(career?.regular.pointPctg)} />
              <Meta label="Playoffs" value={wlo(career?.playoffs, false)} />
              <Meta label="Seasons" value={career ? String(career.seasons) : "—"} />
              <Meta label="Jack Adams" value={career ? String(career.jackAdams) : "—"} />
              <Meta label="Stanley Cups" value={career ? String(career.stanleyCups) : "—"} />
            </dl>
          </div>
        </div>
      </article>

      {career ? (
        <section className="bg-panel rounded-xl border border-white/[0.08] p-4">
          <h2 className="rule-head mb-3">Career résumé</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatChip label="Games" value={String(career.regular.games)} />
            <StatChip label="Record" value={wlo(career.regular)} detail="W-L-OTL, regular season" />
            <StatChip label="Points" value={String(career.regular.points ?? "—")} detail={`${pct(career.regular.pointPctg)} point %`} />
            <StatChip
              label="Playoffs"
              value={wlo(career.playoffs, false)}
              detail={
                c.stints
                  .filter((s) => s.playoffs)
                  .map((s) => `${s.teamAbbrev} ${wlo(s.playoffs, false)}`)
                  .join(" · ") || undefined
              }
            />
            <StatChip label="Clubs" value={String(c.stints.length)} detail={c.stints.map((s) => s.teamAbbrev).join(" · ")} />
            <StatChip
              label="Jack Adams"
              value={String(career.jackAdams)}
              detail={
                c.stints
                  .filter((s) => s.jackAdams > 0)
                  .map((s) => `With ${s.franchiseName}`)
                  .join(" · ") || undefined
              }
            />
            <StatChip label="Cup Finals" value={String(career.cupFinals)} />
            <StatChip
              label="First game"
              value={career.firstCoached ? career.firstCoached.slice(0, 4) : "—"}
              detail={career.firstCoached ? formatSportsDateLong(career.firstCoached) : undefined}
            />
          </div>
        </section>
      ) : null}

      {c.stints.length > 0 ? (
        <section className="bg-panel rounded-xl border border-white/[0.08] p-4">
          <h2 className="rule-head mb-3">Coaching stops</h2>
          <ul className="space-y-4">
            {c.stints.map((s) => (
              <li key={`${s.teamAbbrev}-${s.startSeason}`} className="flex gap-3 border-l-2 border-accent/45 pl-3">
                {s.logo ? <img src={s.logo} alt="" className="mt-0.5 h-9 w-9 shrink-0 object-contain" /> : null}
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-[#e8e4d9]">
                    {s.espnTeamId ? (
                      <Link to={`/sports/nhl/team/${s.espnTeamId}`} className="hover:underline">
                        {s.franchiseName}
                      </Link>
                    ) : (
                      s.franchiseName
                    )}{" "}
                    <span className="numeral text-[13px] font-normal text-[#8b93a7]">
                      {s.startSeason}
                      {s.endSeason !== s.startSeason ? ` – ${s.endSeason}` : ""}
                    </span>
                    {s.current ? (
                      <span className="ml-2 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-300">
                        Current
                      </span>
                    ) : null}
                  </p>
                  <p className="numeral mt-0.5 text-[13px] text-[#c8cdd8]">
                    {wlo(s.regular)}
                    {s.regular ? ` · ${s.regular.points ?? 0} pts · ${pct(s.regular.pointPctg)}` : ""}
                  </p>
                  {s.playoffs ? (
                    <p className="numeral mt-0.5 text-[12px] text-[#8b93a7]">
                      Playoffs {wlo(s.playoffs, false)} in {s.playoffs.games} games
                    </p>
                  ) : null}
                  {s.jackAdams > 0 || s.stanleyCups > 0 ? (
                    <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-200">
                      <Trophy size={11} />
                      {[s.stanleyCups ? `${s.stanleyCups}× Stanley Cup` : null, s.jackAdams ? "Jack Adams" : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]">
        <div className="border-b border-white/[0.06] px-4 py-2.5">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e8e4d9]">
            Record by club
          </h2>
        </div>
        {c.stints.length === 0 ? (
          c.espnRecords.length ? (
            <ul className="divide-y divide-white/[0.05]">
              {c.espnRecords.map((r) => (
                <li key={r.label} className="flex items-center justify-between px-4 py-2.5 text-[13px]">
                  <span className="text-[#c8cdd8]">{r.label}</span>
                  <span className="numeral text-cream">{r.summary}</span>
                </li>
              ))}
              <li className="px-4 py-2 text-[11px] text-[#8b93a7]">ESPN career lines (W-L-T-OTL); may be incomplete.</li>
            </ul>
          ) : (
            <p className="px-4 py-6 text-[13px] text-[#8b93a7]">Coaching record unavailable right now.</p>
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-[12px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.12em] text-[#8b93a7]">
                  <th className="px-3 py-2 font-medium">Seasons</th>
                  <th className="px-3 py-2 font-medium">Tm</th>
                  <th className="px-3 py-2 font-medium">GP</th>
                  <th className="px-3 py-2 font-medium">W-L-OTL</th>
                  <th className="px-3 py-2 font-medium">Pts</th>
                  <th className="px-3 py-2 font-medium">Pt%</th>
                  <th className="px-3 py-2 font-medium">Playoffs</th>
                </tr>
              </thead>
              <tbody>
                {c.stints.map((s) => (
                  <tr key={`${s.teamAbbrev}-${s.startSeason}`} className="border-t border-white/[0.05]">
                    <td className="numeral text-cream px-3 py-2">
                      {s.startSeason}
                      {s.endSeason !== s.startSeason ? ` – ${s.endSeason}` : ""}
                    </td>
                    <td className="px-3 py-2 text-[#c8cdd8]">{s.teamAbbrev}</td>
                    <td className="numeral px-3 py-2 text-[#c8cdd8]">{s.regular?.games ?? "—"}</td>
                    <td className="numeral text-cream px-3 py-2">{wlo(s.regular)}</td>
                    <td className="numeral px-3 py-2 text-[#c8cdd8]">{s.regular?.points ?? "—"}</td>
                    <td className="numeral px-3 py-2 text-[#c8cdd8]">{pct(s.regular?.pointPctg)}</td>
                    <td className="numeral px-3 py-2 text-[#c8cdd8]">{s.playoffs ? wlo(s.playoffs, false) : "—"}</td>
                  </tr>
                ))}
                {career ? (
                  <tr className="border-t border-white/[0.12] bg-white/[0.03]">
                    <td className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#e8e4d9]">
                      Career
                    </td>
                    <td className="px-3 py-2.5 text-[#8b93a7]">—</td>
                    <td className="numeral px-3 py-2.5 text-[#e8e4d9]">{career.regular.games}</td>
                    <td className="numeral text-cream px-3 py-2.5 font-semibold">{wlo(career.regular)}</td>
                    <td className="numeral px-3 py-2.5 text-[#e8e4d9]">{career.regular.points}</td>
                    <td className="numeral px-3 py-2.5 text-[#e8e4d9]">{pct(career.regular.pointPctg)}</td>
                    <td className="numeral px-3 py-2.5 text-[#c8cdd8]">{wlo(career.playoffs, false)}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
            <p className="border-t border-white/[0.06] px-4 py-2 text-[10.5px] text-[#6f778a]">
              Head-coaching records from NHL Records. OTL includes shootout losses.
            </p>
          </div>
        )}
      </section>

      {c.bio ? (
        <section className="bg-panel rounded-xl border border-white/[0.08] p-4">
          <h2 className="rule-head mb-3">Profile</h2>
          <p className="font-display text-[16px] leading-relaxed text-[#e8e4d9]">{c.bio}</p>
          {c.bioUrl ? (
            <a
              href={c.bioUrl}
              target="_blank"
              rel="noreferrer"
              className="text-accent mt-3 inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.14em] hover:underline"
            >
              Wikipedia <ExternalLink size={11} />
            </a>
          ) : null}
        </section>
      ) : null}

      <section className="bg-panel rounded-xl border border-white/[0.08] p-4">
        <h2 className="rule-head mb-3">Snapshot</h2>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 text-[13px] sm:grid-cols-2">
          <Fact label="Born" value={c.birthDate ? formatSportsDateLong(c.birthDate) : null} />
          <Fact label="Birthplace" value={c.birthPlace} />
          <Fact label="College" value={c.college} />
          <Fact
            label="NHL playing career"
            value={
              c.playing?.totals
                ? `${c.playing.totals.gp} GP · ${c.playing.totals.g} G · ${c.playing.totals.a} A · ${c.playing.totals.pts} PTS`
                : null
            }
          />
        </dl>
      </section>

      {c.playing && c.playing.seasons.length > 0 ? (
        <section className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]">
          <div className="border-b border-white/[0.06] px-4 py-2.5">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e8e4d9]">
              Playing career · NHL
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-[12px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.12em] text-[#8b93a7]">
                  <th className="px-3 py-2 font-medium">Season</th>
                  <th className="px-3 py-2 font-medium">Team</th>
                  <th className="px-3 py-2 text-right font-medium">GP</th>
                  <th className="px-3 py-2 text-right font-medium">G</th>
                  <th className="px-3 py-2 text-right font-medium">A</th>
                  <th className="px-3 py-2 text-right font-medium">PTS</th>
                </tr>
              </thead>
              <tbody>
                {[...c.playing.seasons].reverse().map((row) => (
                  <tr key={`${row.season}-${row.team}`} className="border-t border-white/[0.05]">
                    <td className="numeral text-cream px-3 py-2">{row.season}</td>
                    <td className="px-3 py-2 text-[#c8cdd8]">{row.team}</td>
                    <td className="numeral px-3 py-2 text-right text-[#c8cdd8]">{row.gp}</td>
                    <td className="numeral px-3 py-2 text-right text-[#c8cdd8]">{row.g}</td>
                    <td className="numeral px-3 py-2 text-right text-[#c8cdd8]">{row.a}</td>
                    <td className="numeral text-cream px-3 py-2 text-right">{row.pts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.14em] text-white/50">{label}</dt>
      <dd className="numeral mt-0.5 text-white">{value}</dd>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex flex-col">
      <dt className="text-[10px] uppercase tracking-[0.14em] text-[#8b93a7]">{label}</dt>
      <dd className="text-[#e8e4d9]">{value}</dd>
    </div>
  );
}

function StatChip({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className={cn("rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-2.5")}>
      <p className="text-[10px] uppercase tracking-[0.14em] text-[#8b93a7]">{label}</p>
      <p className="numeral text-cream mt-1 text-[18px] leading-none">{value}</p>
      {detail ? <p className="mt-1.5 text-[11px] leading-snug text-[#8b93a7]">{detail}</p> : null}
    </div>
  );
}
