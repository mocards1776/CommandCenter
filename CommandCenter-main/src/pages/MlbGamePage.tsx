import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import {
  fetchMlbBoxscore,
  mlbTeamLogo,
  type MlbBoxscoreBatter,
  type MlbBoxscorePitcher,
  type MlbBoxscoreSide,
} from "@/lib/mlb";
import { cn } from "@/lib/utils";

export default function MlbGamePage() {
  const { gamePk } = useParams<{ gamePk: string }>();
  const navigate = useNavigate();

  const box = useQuery({
    queryKey: ["mlb-boxscore", gamePk],
    queryFn: () => fetchMlbBoxscore(gamePk!),
    enabled: Boolean(gamePk),
    staleTime: 30_000,
    refetchInterval: (q) =>
      q.state.data?.status && /progress|live|in progress/i.test(q.state.data.status)
        ? 20_000
        : false,
  });

  if (box.isPending) {
    return (
      <div className="text-chalk flex min-h-[50vh] items-center justify-center gap-2">
        <Loader2 size={18} className="animate-spin" />
        Loading box score…
      </div>
    );
  }

  if (box.isError || !box.data) {
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
          {box.error instanceof Error ? box.error.message : "Box score unavailable"}
        </p>
      </div>
    );
  }

  const g = box.data;

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 md:p-7">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-chalk hover:text-cream flex items-center gap-2 text-[11px] uppercase tracking-[0.14em]"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <Link
          to="/sports/mlb"
          className="text-chalk-dim hover:text-cream text-[11px] uppercase tracking-[0.14em]"
        >
          MLB hub
        </Link>
      </div>

      <header className="bg-panel rounded-xl border border-white/[0.08] p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
            {g.status}
            {g.venue ? ` · ${g.venue}` : ""}
          </p>
          {g.when && <p className="text-[11px] text-[#8b93a7]">{g.when}</p>}
        </div>

        <div className="flex items-center justify-between gap-3">
          <ScoreTeam side={g.away} />
          <span className="font-display text-cream text-[28px] tabular-nums">
            {g.away.runs}
            <span className="text-chalk-dim mx-2 text-[18px]">–</span>
            {g.home.runs}
          </span>
          <ScoreTeam side={g.home} align="right" />
        </div>

        {g.innings.length > 0 && (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[420px] text-center text-[12px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.12em] text-[#8b93a7]">
                  <th className="px-1 py-1 text-left font-medium"> </th>
                  {g.innings.map((i) => (
                    <th key={i.num} className="numeral px-1 py-1 font-medium">
                      {i.num}
                    </th>
                  ))}
                  <th className="numeral px-1.5 py-1 font-medium">R</th>
                  <th className="numeral px-1.5 py-1 font-medium">H</th>
                  <th className="numeral px-1.5 py-1 font-medium">E</th>
                </tr>
              </thead>
              <tbody>
                <InningRow side={g.away} innings={g.innings} which="away" />
                <InningRow side={g.home} innings={g.innings} which="home" />
              </tbody>
            </table>
          </div>
        )}
      </header>

      <BoxSide title={g.away.name} side={g.away} />
      <BoxSide title={g.home.name} side={g.home} />
    </div>
  );
}

function ScoreTeam({ side, align }: { side: MlbBoxscoreSide; align?: "right" }) {
  return (
    <div className={cn("flex min-w-0 flex-1 items-center gap-2", align === "right" && "flex-row-reverse text-right")}>
      <img src={mlbTeamLogo(side.teamId)} alt="" className="h-10 w-10 shrink-0 object-contain" />
      <div className="min-w-0">
        <p className="text-cream truncate text-[15px] font-semibold">{side.abbrev}</p>
        <p className="truncate text-[11px] text-[#8b93a7]">{side.name}</p>
      </div>
    </div>
  );
}

function InningRow({
  side,
  innings,
  which,
}: {
  side: MlbBoxscoreSide;
  innings: { num: number; away: number | null; home: number | null }[];
  which: "away" | "home";
}) {
  return (
    <tr className="border-t border-white/[0.05]">
      <td className="text-cream px-1 py-1.5 text-left font-medium">{side.abbrev}</td>
      {innings.map((i) => (
        <td key={i.num} className="numeral px-1 py-1.5 text-[#c8cdd8]">
          {i[which] ?? "—"}
        </td>
      ))}
      <td className="numeral text-cream px-1.5 py-1.5 font-semibold">{side.runs}</td>
      <td className="numeral px-1.5 py-1.5 text-[#c8cdd8]">{side.hits}</td>
      <td className="numeral px-1.5 py-1.5 text-[#c8cdd8]">{side.errors}</td>
    </tr>
  );
}

function BoxSide({ title, side }: { title: string; side: MlbBoxscoreSide }) {
  return (
    <section className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]">
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-2.5">
        <img src={mlbTeamLogo(side.teamId)} alt="" className="h-6 w-6 object-contain" />
        <h2 className="font-display text-cream text-[18px]">{title}</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-[12px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.12em] text-[#8b93a7]">
              <th className="px-3 py-2 font-medium">Batter</th>
              <th className="numeral px-1.5 py-2 font-medium">AB</th>
              <th className="numeral px-1.5 py-2 font-medium">R</th>
              <th className="numeral px-1.5 py-2 font-medium">H</th>
              <th className="numeral px-1.5 py-2 font-medium">RBI</th>
              <th className="numeral px-1.5 py-2 font-medium">BB</th>
              <th className="numeral px-1.5 py-2 font-medium">SO</th>
            </tr>
          </thead>
          <tbody>
            {side.batters.map((b) => (
              <BatterRow key={b.id} b={b} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto border-t border-white/[0.06]">
        <table className="w-full min-w-[520px] text-left text-[12px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.12em] text-[#8b93a7]">
              <th className="px-3 py-2 font-medium">Pitcher</th>
              <th className="numeral px-1.5 py-2 font-medium">IP</th>
              <th className="numeral px-1.5 py-2 font-medium">H</th>
              <th className="numeral px-1.5 py-2 font-medium">R</th>
              <th className="numeral px-1.5 py-2 font-medium">ER</th>
              <th className="numeral px-1.5 py-2 font-medium">BB</th>
              <th className="numeral px-1.5 py-2 font-medium">SO</th>
            </tr>
          </thead>
          <tbody>
            {side.pitchers.map((p) => (
              <PitcherRow key={p.id} p={p} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BatterRow({ b }: { b: MlbBoxscoreBatter }) {
  return (
    <tr className="border-t border-white/[0.04]">
      <td className="px-3 py-1.5">
        <Link to={`/sports/mlb/player/${b.id}`} className="text-cream hover:underline">
          {b.name}
        </Link>
        {b.position ? (
          <span className="ml-1.5 text-[10px] text-[#8b93a7]">{b.position}</span>
        ) : null}
      </td>
      <td className="numeral px-1.5 py-1.5 text-[#c8cdd8]">{b.ab}</td>
      <td className="numeral px-1.5 py-1.5 text-[#c8cdd8]">{b.r}</td>
      <td className="numeral text-cream px-1.5 py-1.5">{b.h}</td>
      <td className="numeral px-1.5 py-1.5 text-[#c8cdd8]">{b.rbi}</td>
      <td className="numeral px-1.5 py-1.5 text-[#c8cdd8]">{b.bb}</td>
      <td className="numeral px-1.5 py-1.5 text-[#c8cdd8]">{b.so}</td>
    </tr>
  );
}

function PitcherRow({ p }: { p: MlbBoxscorePitcher }) {
  return (
    <tr className="border-t border-white/[0.04]">
      <td className="px-3 py-1.5">
        <Link to={`/sports/mlb/player/${p.id}`} className="text-cream hover:underline">
          {p.name}
        </Link>
        {p.note ? <span className="text-accent ml-1.5 text-[11px]">{p.note}</span> : null}
      </td>
      <td className="numeral text-cream px-1.5 py-1.5">{p.ip}</td>
      <td className="numeral px-1.5 py-1.5 text-[#c8cdd8]">{p.h}</td>
      <td className="numeral px-1.5 py-1.5 text-[#c8cdd8]">{p.r}</td>
      <td className="numeral px-1.5 py-1.5 text-[#c8cdd8]">{p.er}</td>
      <td className="numeral px-1.5 py-1.5 text-[#c8cdd8]">{p.bb}</td>
      <td className="numeral px-1.5 py-1.5 text-[#c8cdd8]">{p.so}</td>
    </tr>
  );
}
