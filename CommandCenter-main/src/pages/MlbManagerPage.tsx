import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Flame, Loader2 } from "lucide-react";
import {
  fetchMlbManagerDetail,
  mlbTeamLogo,
  teamPagePath,
} from "@/lib/mlb";
import { cn } from "@/lib/utils";

function heatTone(rank: number): string {
  if (rank <= 5) return "text-alert";
  if (rank <= 12) return "text-amber-300";
  if (rank <= 20) return "text-[#c8cdd8]";
  return "text-emerald-300";
}

export default function MlbManagerPage() {
  const { managerId } = useParams<{ managerId: string }>();
  const navigate = useNavigate();

  const detail = useQuery({
    queryKey: ["mlb-manager", managerId],
    queryFn: () => fetchMlbManagerDetail(managerId!),
    enabled: Boolean(managerId),
    staleTime: 180_000,
  });

  if (detail.isPending) {
    return (
      <div className="text-chalk flex min-h-[50vh] items-center justify-center gap-2">
        <Loader2 size={18} className="animate-spin" />
        Loading manager…
      </div>
    );
  }

  if (detail.isError || !detail.data) {
    return (
      <div className="p-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-chalk hover:text-cream mb-4 flex items-center gap-2 text-[11px] uppercase tracking-[0.14em]"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <p className="text-alert text-[13px]">
          {detail.error instanceof Error ? detail.error.message : "Manager not found"}
        </p>
      </div>
    );
  }

  const m = detail.data;
  const accent = `#${m.primaryColor}`;
  const wikiUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(m.name.replace(/\s+/g, "_"))}`;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-7">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-chalk hover:text-cream flex items-center gap-2 text-[11px] uppercase tracking-[0.14em]"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <Link
          to="/sports/mlb/managers"
          className="text-chalk-dim hover:text-cream text-[11px] uppercase tracking-[0.14em]"
        >
          All managers
        </Link>
      </div>

      <article className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start">
          <img
            src={m.headshot}
            alt=""
            width={120}
            height={120}
            className="mx-auto h-[108px] w-[108px] rounded-lg bg-[#0c1a2e] object-cover object-top ring-1 ring-white/10 sm:mx-0"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-2 flex items-center gap-2">
                  <img src={mlbTeamLogo(m.teamId)} alt="" className="h-6 w-6 object-contain" />
                  <Link
                    to={teamPagePath(m.teamId)}
                    className="text-chalk hover:text-cream text-[13px] font-medium transition"
                  >
                    {m.teamName}
                  </Link>
                </div>
                <h1 className="font-display text-cream text-[34px] leading-[0.95] sm:text-[42px]">
                  {m.name}
                </h1>
                <p className="text-chalk mt-1.5 text-[13px]">Manager · {m.teamAbbrev}</p>
              </div>
              {m.age != null && (
                <div
                  className="shrink-0 rounded-md px-3 py-2 text-center"
                  style={{ background: `${accent}22`, border: `1px solid ${accent}55` }}
                >
                  <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#8b93a7]">
                    Age
                  </p>
                  <p className="numeral text-cream text-[28px] leading-none">{m.age}</p>
                </div>
              )}
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-2.5 text-[12.5px] sm:grid-cols-4">
              <Meta label="Record" value={m.record} />
              <Meta label="Win %" value={`${(m.winPct * 100).toFixed(1)}%`} />
              <Meta label="GB" value={m.gb} />
              <Meta
                label="Playoff %"
                value={m.playoffOdds != null ? `${m.playoffOdds.toFixed(1)}%` : "—"}
              />
              <Meta label="Birthdate" value={m.birthDate ?? "—"} />
              <Meta label="Birthplace" value={m.birthPlace ?? "—"} />
              <Meta label="School" value={m.school ?? "—"} />
              <Meta label="Division rank" value={m.divisionRank != null ? String(m.divisionRank) : "—"} />
            </dl>
          </div>
        </div>
      </article>

      <section className="bg-panel rounded-xl border border-white/[0.08] p-4">
        <div className="mb-3 flex items-center gap-2">
          <Flame size={16} className={heatTone(m.hotSeatRank)} />
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#c8cdd8]">
            Hot seat
          </h2>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <p className={cn("numeral text-[42px] leading-none", heatTone(m.hotSeatRank))}>
              #{m.hotSeatRank}
            </p>
            <p className="mt-1 text-[12px] text-[#8b93a7]">of 30 managers</p>
          </div>
          <div>
            <p className="numeral text-cream text-[28px] leading-none">{m.hotSeatScore.toFixed(1)}</p>
            <p className="mt-1 text-[12px] text-[#8b93a7]">heat score</p>
          </div>
        </div>
        {m.contractNote && (
          <p className="text-cream mt-4 text-[13.5px] leading-relaxed">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8b93a7]">
              Contract{" "}
            </span>
            {m.contractNote}
          </p>
        )}
      </section>

      {m.wikiExtract && (
        <section className="bg-panel rounded-xl border border-white/[0.08] p-4">
          <h2 className="rule-head mb-3">Profile</h2>
          <p className="font-display text-[16px] leading-relaxed text-[#e8e4d9]">{m.wikiExtract}</p>
          <a
            href={wikiUrl}
            target="_blank"
            rel="noreferrer"
            className="text-accent mt-3 inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.14em] hover:underline"
          >
            Wikipedia <ExternalLink size={11} />
          </a>
        </section>
      )}

      <section className="bg-panel rounded-xl border border-white/[0.08] p-4">
        <h2 className="rule-head mb-3">Snapshot</h2>
        <ul className="space-y-2">
          {m.careerNotes.map((line) => (
            <li
              key={line}
              className="border-l-2 border-accent/45 pl-3 text-[13px] leading-relaxed text-[#c8cdd8]"
            >
              {line}
            </li>
          ))}
        </ul>
      </section>

      {m.timeline.length > 0 && (
        <section className="bg-panel rounded-xl border border-white/[0.08] p-4">
          <h2 className="rule-head mb-3">Transaction history</h2>
          <ul className="space-y-3">
            {[...m.timeline].reverse().map((t) => (
              <li key={`${t.date}-${t.text}`} className="text-[13px] leading-relaxed">
                <span className="numeral text-accent mr-2 text-[12px]">{t.date}</span>
                <span className="text-[#c8cdd8]">{t.text}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {m.playingCareer.length > 0 && (
        <section className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]">
          <div className="border-b border-white/[0.06] px-4 py-2.5">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
              Playing career
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-[12px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.12em] text-[#8b93a7]">
                  <th className="px-3 py-2 font-medium">Year</th>
                  <th className="px-3 py-2 font-medium">Team</th>
                  <th className="px-3 py-2 font-medium">G</th>
                  <th className="px-3 py-2 font-medium">Line</th>
                </tr>
              </thead>
              <tbody>
                {[...m.playingCareer].reverse().map((row) => (
                  <tr key={`${row.season}-${row.team}`} className="border-t border-white/[0.05]">
                    <td className="numeral text-cream px-3 py-2">{row.season}</td>
                    <td className="px-3 py-2 text-[#c8cdd8]">{row.team}</td>
                    <td className="numeral text-cream px-3 py-2">{row.games}</td>
                    <td className="px-3 py-2 text-[#a8b0c2]">{row.summary || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.14em] text-[#8b93a7]">{label}</dt>
      <dd className="text-cream mt-0.5">{value}</dd>
    </div>
  );
}
