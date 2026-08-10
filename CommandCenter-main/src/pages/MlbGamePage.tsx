import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Loader2 } from "lucide-react";
import HighlightReel from "@/components/sports/HighlightReel";
import TeamMark from "@/components/sports/TeamMark";
import {
  buildPlayerNameIndex,
  fetchEspnGameRecap,
  fetchMlbBoxscore,
  fetchMlbGameHighlights,
  formatGameDuration,
  parseEspnRecapHtml,
  resolveMissingRecapPlayers,
  teamPagePath,
  type MlbBoxscoreBatter,
  type MlbBoxscorePitcher,
  type MlbBoxscoreSide,
  type MlbGameRecap,
  type RecapInline,
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

  const highlights = useQuery({
    queryKey: ["mlb-game-highlights", gamePk],
    queryFn: () => fetchMlbGameHighlights(gamePk!),
    enabled: Boolean(gamePk),
    staleTime: 60_000,
  });

  const recap = useQuery({
    queryKey: [
      "mlb-game-recap",
      gamePk,
      box.data?.officialDate,
      box.data?.home.abbrev,
      box.data?.away.abbrev,
    ],
    queryFn: () =>
      fetchEspnGameRecap(box.data!.officialDate, box.data!.home.abbrev, box.data!.away.abbrev),
    enabled: Boolean(box.data?.officialDate && box.data.home.abbrev && box.data.away.abbrev),
    staleTime: 300_000,
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
  const duration = formatGameDuration(g.gameDurationMinutes);
  const metaBits = [
    g.venue,
    g.when,
    duration ? `Time ${duration}` : null,
    g.attendance != null ? `Att ${g.attendance.toLocaleString("en-US")}` : null,
    g.weather,
  ].filter(Boolean);

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

      {/* ESPN-style game header */}
      <header className="overflow-hidden rounded-xl border border-white/[0.1] bg-[#0a1424]">
        <div className="flex items-center justify-between gap-2 border-b border-white/[0.07] px-4 py-2.5">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#a8b0c2]">
            {g.status}
          </p>
          {g.officialDate && (
            <p className="text-[11px] text-[#8b93a7]">
              {new Date(`${g.officialDate}T12:00:00`).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          )}
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-5 sm:gap-4 sm:px-6">
          <EspnTeam side={g.away} align="left" />
          <div className="text-center">
            <p className="font-display text-[44px] leading-none tabular-nums text-white sm:text-[56px]">
              <span className={g.away.runs > g.home.runs ? "text-white" : "text-white/55"}>
                {g.away.runs}
              </span>
              <span className="mx-2 text-[22px] text-white/25 sm:mx-3">-</span>
              <span className={g.home.runs > g.away.runs ? "text-white" : "text-white/55"}>
                {g.home.runs}
              </span>
            </p>
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
              {g.status === "Final" ? "Final" : g.status}
            </p>
          </div>
          <EspnTeam side={g.home} align="right" />
        </div>

        {g.innings.length > 0 && (
          <div className="overflow-x-auto border-t border-white/[0.07]">
            <table className="w-full min-w-[440px] text-center text-[12px]">
              <thead>
                <tr className="bg-white/[0.03] text-[10px] uppercase tracking-[0.12em] text-[#8b93a7]">
                  <th className="px-3 py-2 text-left font-medium"> </th>
                  {g.innings.map((i) => (
                    <th key={i.num} className="numeral px-1 py-2 font-medium">
                      {i.num}
                    </th>
                  ))}
                  <th className="numeral px-2 py-2 font-semibold text-white/70">R</th>
                  <th className="numeral px-2 py-2 font-medium">H</th>
                  <th className="numeral px-2 py-2 font-medium">E</th>
                </tr>
              </thead>
              <tbody>
                <InningRow side={g.away} innings={g.innings} which="away" />
                <InningRow side={g.home} innings={g.innings} which="home" />
              </tbody>
            </table>
          </div>
        )}

        {metaBits.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-white/[0.07] px-4 py-3 text-[11.5px] text-[#a8b0c2]">
            {metaBits.map((bit) => (
              <span key={String(bit)}>{bit}</span>
            ))}
          </div>
        )}
      </header>

      {recap.isPending && (
        <p className="text-chalk-dim flex items-center gap-2 text-[12px]">
          <Loader2 size={14} className="animate-spin" /> Loading game wrap…
        </p>
      )}
      {recap.data && <GameWrap recap={recap.data} box={g} />}

      {highlights.isPending && (
        <p className="text-chalk-dim flex items-center gap-2 text-[12px]">
          <Loader2 size={14} className="animate-spin" /> Loading highlights…
        </p>
      )}
      <HighlightReel highlights={highlights.data ?? []} title="Game highlights" />

      <BoxSide title={g.away.name} side={g.away} />
      <BoxSide title={g.home.name} side={g.home} />
    </div>
  );
}

function EspnTeam({ side, align }: { side: MlbBoxscoreSide; align: "left" | "right" }) {
  return (
    <Link
      to={teamPagePath(side.teamId)}
      className={cn(
        "flex min-w-0 flex-col items-center gap-2 transition hover:opacity-90",
        align === "left" ? "sm:items-start" : "sm:items-end",
      )}
    >
      <TeamMark teamId={side.teamId} size="xl" />
      <div className={cn("text-center", align === "left" ? "sm:text-left" : "sm:text-right")}>
        <p className="text-[15px] font-bold tracking-wide text-white underline-offset-2 hover:underline sm:text-[17px]">
          {side.abbrev}
        </p>
        <p className="truncate text-[11px] text-[#8b93a7]">{side.name}</p>
      </div>
    </Link>
  );
}

function GameWrap({
  recap,
  box,
}: {
  recap: MlbGameRecap;
  box: {
    away: MlbBoxscoreSide;
    home: MlbBoxscoreSide;
  };
}) {
  const [open, setOpen] = useState(false);
  const [segments, setSegments] = useState<RecapInline[]>([]);

  const nameIndex = useMemo(() => {
    const players = [
      ...box.away.batters.map((b) => ({ id: b.id, name: b.name })),
      ...box.home.batters.map((b) => ({ id: b.id, name: b.name })),
      ...box.away.pitchers.map((p) => ({ id: p.id, name: p.name })),
      ...box.home.pitchers.map((p) => ({ id: p.id, name: p.name })),
    ];
    return buildPlayerNameIndex(players);
  }, [box]);

  useEffect(() => {
    const parsed = parseEspnRecapHtml(recap.storyHtml || recap.storyText, nameIndex);
    setSegments(parsed);
    let cancelled = false;
    void resolveMissingRecapPlayers(parsed).then((resolved) => {
      if (!cancelled) setSegments(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [recap.storyHtml, recap.storyText, nameIndex]);

  const storyText = recap.storyText.replace(/—\s*—/g, "—").trim();
  const desc = (recap.description ?? "").replace(/^—\s*/, "").trim();
  const showDesc = Boolean(desc) && !storyText.toLowerCase().includes(desc.toLowerCase().slice(0, 48));
  const long = storyText.length > 420;

  const rendered = (
    <RecapBody segments={segments.length ? segments : [{ kind: "text", text: storyText }]} />
  );

  return (
    <section className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]">
      <div className="border-b border-white/[0.06] px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">Game wrap</p>
        <h2 className="font-display text-cream mt-1 text-[22px] leading-snug">{recap.headline}</h2>
        {showDesc && (
          <p className="font-display mt-2 text-[15px] leading-relaxed text-[#d8d2c4]">{desc}</p>
        )}
      </div>
      <div className="px-4 py-4">
        <div
          className={cn(
            "font-display text-[16.5px] leading-[1.65] text-[#ebe6d8]",
            !open && long && "line-clamp-6",
          )}
        >
          {rendered}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {long && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent hover:underline"
            >
              {open ? "Show less" : "Read full wrap"}
            </button>
          )}
          <a
            href={recap.url}
            target="_blank"
            rel="noreferrer"
            className="text-chalk-dim hover:text-cream inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.14em]"
          >
            ESPN <ExternalLink size={11} />
          </a>
        </div>
      </div>
    </section>
  );
}

function RecapBody({ segments }: { segments: RecapInline[] }) {
  const linkClass =
    "text-inherit underline decoration-white/20 underline-offset-[3px] transition hover:decoration-white/45";
  const nodes: ReactNode[] = [];
  segments.forEach((seg, i) => {
    if (seg.kind === "text") {
      nodes.push(<span key={i}>{seg.text}</span>);
      return;
    }
    if (seg.kind === "player" && seg.playerId != null) {
      nodes.push(
        <Link key={i} to={`/sports/mlb/player/${seg.playerId}`} className={linkClass}>
          {seg.text}
        </Link>,
      );
      return;
    }
    if (seg.kind === "team" && seg.teamId != null) {
      nodes.push(
        <Link key={i} to={teamPagePath(seg.teamId)} className={linkClass}>
          {seg.text}
        </Link>,
      );
      return;
    }
    if (seg.kind === "ext") {
      nodes.push(
        <a key={i} href={seg.href} target="_blank" rel="noreferrer" className={linkClass}>
          {seg.text}
        </a>,
      );
      return;
    }
    nodes.push(<span key={i}>{seg.text}</span>);
  });
  return <>{nodes}</>;
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
      <td className="px-3 py-2 text-left text-[12px] font-semibold text-white">
        <Link to={teamPagePath(side.teamId)} className="hover:text-accent hover:underline">
          {side.abbrev}
        </Link>
      </td>
      {innings.map((i) => (
        <td key={i.num} className="numeral px-1 py-2 text-[#c8cdd8]">
          {i[which] ?? "—"}
        </td>
      ))}
      <td className="numeral px-2 py-2 font-bold text-white">{side.runs}</td>
      <td className="numeral px-2 py-2 text-[#c8cdd8]">{side.hits}</td>
      <td className="numeral px-2 py-2 text-[#c8cdd8]">{side.errors}</td>
    </tr>
  );
}

function BoxSide({ title, side }: { title: string; side: MlbBoxscoreSide }) {
  return (
    <section className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]">
      <div className="flex items-center gap-2 border-b border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
        <TeamMark teamId={side.teamId} size="sm" />
        <Link
          to={teamPagePath(side.teamId)}
          className="text-[14px] font-bold tracking-wide text-white hover:text-accent hover:underline"
        >
          {title}
        </Link>
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
