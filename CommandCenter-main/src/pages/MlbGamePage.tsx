import { useEffect, useMemo, useState } from "react";
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
  mlbHeadshot,
  parseEspnRecapHtml,
  resolveMissingRecapPlayers,
  teamPagePath,
  type MlbBoxscore,
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
    queryKey: ["mlb-boxscore-v2", gamePk],
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

      <GameMatchupHeader game={g} />

      {(g.away.probablePitcher || g.home.probablePitcher) && (
        <ProbablePitchers away={g.away} home={g.home} />
      )}

      {g.innings.length > 0 && !g.pregame && (
        <div className="overflow-hidden rounded-xl border border-white/[0.1] bg-[#0a1424]">
          <div className="overflow-x-auto">
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
          {metaBits.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-white/[0.07] px-4 py-3 text-[11.5px] text-[#a8b0c2]">
              {metaBits.map((bit) => (
                <span key={String(bit)}>{bit}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {g.pregame && metaBits.length > 0 && (
        <p className="text-[12px] text-[#a8b0c2]">{metaBits.join(" · ")}</p>
      )}

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

      {!g.pregame && (
        <>
          <BoxSide title={g.away.name} side={g.away} />
          <BoxSide title={g.home.name} side={g.home} />
        </>
      )}
    </div>
  );
}

function GameMatchupHeader({ game: g }: { game: MlbBoxscore }) {
  return (
    <header className="relative overflow-hidden rounded-xl border border-white/[0.1] bg-[#07101d]">
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-1/2 opacity-80"
        style={{
          background: `radial-gradient(ellipse at 20% 45%, #${g.away.primaryColor}66, transparent 58%)`,
        }}
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-1/2 opacity-80"
        style={{
          background: `radial-gradient(ellipse at 80% 45%, #${g.home.primaryColor}66, transparent 58%)`,
        }}
      />

      <div className="relative z-10 flex items-center justify-between gap-2 border-b border-white/[0.07] px-4 py-2.5">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#a8b0c2]">
          {g.pregame ? "Preview" : g.status}
        </p>
        {g.officialDate && (
          <p className="text-[11px] text-[#8b93a7]">
            {new Date(`${g.officialDate}T12:00:00`).toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </p>
        )}
      </div>

      <div className="relative z-10 grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-6 sm:gap-4 sm:px-6">
        <EspnTeam side={g.away} align="left" />
        <div className="px-1 text-center">
          {g.pregame ? (
            <>
              <p className="font-display text-[40px] leading-none tracking-tight text-white sm:text-[52px]">
                {g.whenShort ?? "TBD"}
              </p>
              <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
                First pitch
              </p>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
        <EspnTeam side={g.home} align="right" />
      </div>
    </header>
  );
}

function EspnTeam({ side, align }: { side: MlbBoxscoreSide; align: "left" | "right" }) {
  return (
    <Link
      to={teamPagePath(side.teamId)}
      className={cn(
        "flex min-w-0 flex-col items-center gap-2.5 transition hover:opacity-90",
        align === "left" ? "sm:items-start" : "sm:items-end",
      )}
    >
      <TeamMark teamId={side.teamId} size="xl" className="shadow-[0_8px_28px_rgba(0,0,0,0.45)]" />
      <div className={cn("text-center", align === "left" ? "sm:text-left" : "sm:text-right")}>
        <p className="text-[18px] font-bold tracking-wide text-white sm:text-[22px]">{side.abbrev}</p>
        {side.record ? (
          <p className="numeral mt-1 text-[13px] font-medium text-white/70">{side.record}</p>
        ) : (
          <p className="mt-1 truncate text-[11px] text-[#8b93a7]">{side.name}</p>
        )}
      </div>
    </Link>
  );
}

function ProbablePitchers({
  away,
  home,
}: {
  away: MlbBoxscoreSide;
  home: MlbBoxscoreSide;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-white/[0.1] bg-[#0a1424]">
      <p className="border-b border-white/[0.07] px-4 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8b93a7]">
        Probable pitchers
      </p>
      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3 px-4 py-4 sm:gap-5">
        <PitcherCard side={away} align="left" />
        <span className="pb-8 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/30">
          vs
        </span>
        <PitcherCard side={home} align="right" />
      </div>
    </section>
  );
}

function PitcherCard({
  side,
  align,
}: {
  side: MlbBoxscoreSide;
  align: "left" | "right";
}) {
  const name = side.probablePitcher ?? "TBD";
  const parts = name.split(" ");
  const last = parts.length > 1 ? parts[parts.length - 1] : name;
  const first = parts.length > 1 ? parts.slice(0, -1).join(" ") : "";
  const href = side.probablePitcherId ? `/sports/mlb/player/${side.probablePitcherId}` : null;
  const body = (
    <>
      {side.probablePitcherId ? (
        <div className="relative h-[84px] w-[70px] overflow-hidden rounded-lg bg-[#dfe6f2] ring-1 ring-white/20 sm:h-[96px] sm:w-[78px]">
          <img
            src={mlbHeadshot(side.probablePitcherId, 426)}
            alt=""
            className="absolute inset-0 h-full w-full scale-[1.1] object-cover object-[center_12%]"
          />
        </div>
      ) : (
        <div className="grid h-[84px] w-[70px] place-items-center rounded-lg bg-white/10 text-[11px] text-white/40">
          TBD
        </div>
      )}
      {first && (
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-white/50">{first}</p>
      )}
      <p className="text-[16px] font-semibold leading-tight text-white sm:text-[18px]">{last}</p>
    </>
  );
  const cls = cn(
    "flex min-w-0 flex-col gap-1.5",
    align === "right" ? "items-end text-right" : "items-start text-left",
  );
  if (!href) return <div className={cls}>{body}</div>;
  return (
    <Link to={href} className={cn(cls, "transition hover:opacity-95")}>
      {body}
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
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
          {box.away.batters.length || box.home.batters.length ? "Game wrap" : "Game preview"}
        </p>
        <h2 className="mt-1 text-[20px] font-semibold leading-snug text-cream sm:text-[22px]">
          {recap.headline}
        </h2>
        {showDesc && (
          <p className="mt-2 text-[14px] leading-relaxed text-[#c8cdd8]">{desc}</p>
        )}
      </div>
      <div className="px-4 py-4">
        <div
          className={cn(
            "text-[15px] leading-[1.7] text-[#d5dae6]",
            !open && long && "line-clamp-[12]",
          )}
        >
          {rendered}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {long && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent hover:underline"
            >
              {open ? "Show less" : "Read full story"}
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
    "font-medium text-[#9ec1ff] decoration-transparent underline-offset-[3px] transition hover:underline hover:decoration-[#9ec1ff]/55";

  // Split on paragraph breaks preserved in text segments.
  const paragraphs: RecapInline[][] = [[]];
  for (const seg of segments) {
    if (seg.kind !== "text") {
      paragraphs[paragraphs.length - 1].push(seg);
      continue;
    }
    const chunks = seg.text.split(/\n{2,}/);
    chunks.forEach((chunk, i) => {
      if (i > 0) paragraphs.push([]);
      if (chunk) paragraphs[paragraphs.length - 1].push({ kind: "text", text: chunk.trim() });
    });
  }

  return (
    <div className="space-y-3.5">
      {paragraphs
        .filter((p) => p.some((s) => s.text.trim()))
        .map((para, pi) => (
          <p key={pi} className="text-pretty">
            {para.map((seg, i) => {
              if (seg.kind === "text") return <span key={i}>{seg.text}</span>;
              if (seg.kind === "player" && seg.playerId != null) {
                return (
                  <Link key={i} to={`/sports/mlb/player/${seg.playerId}`} className={linkClass}>
                    {seg.text}
                  </Link>
                );
              }
              if (seg.kind === "team" && seg.teamId != null) {
                return (
                  <Link key={i} to={teamPagePath(seg.teamId)} className={linkClass}>
                    {seg.text}
                  </Link>
                );
              }
              if (seg.kind === "ext") {
                return (
                  <a key={i} href={seg.href} target="_blank" rel="noreferrer" className={linkClass}>
                    {seg.text}
                  </a>
                );
              }
              return <span key={i}>{seg.text}</span>;
            })}
          </p>
        ))}
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
        {side.record && <span className="numeral text-[12px] text-[#8b93a7]">{side.record}</span>}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-[12px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.12em] text-[#8b93a7]">
              <th className="px-3 py-2 font-medium">Batter</th>
              <th className="numeral px-2 py-2 font-medium">AB</th>
              <th className="numeral px-2 py-2 font-medium">R</th>
              <th className="numeral px-2 py-2 font-medium">H</th>
              <th className="numeral px-2 py-2 font-medium">RBI</th>
              <th className="numeral px-2 py-2 font-medium">BB</th>
              <th className="numeral px-2 py-2 font-medium">SO</th>
            </tr>
          </thead>
          <tbody>
            {side.batters.map((b) => (
              <BatterRow key={b.id} b={b} />
            ))}
          </tbody>
        </table>
      </div>

      {side.pitchers.length > 0 && (
        <div className="overflow-x-auto border-t border-white/[0.06]">
          <table className="w-full min-w-[520px] text-left text-[12px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.12em] text-[#8b93a7]">
                <th className="px-3 py-2 font-medium">Pitcher</th>
                <th className="numeral px-2 py-2 font-medium">IP</th>
                <th className="numeral px-2 py-2 font-medium">H</th>
                <th className="numeral px-2 py-2 font-medium">R</th>
                <th className="numeral px-2 py-2 font-medium">ER</th>
                <th className="numeral px-2 py-2 font-medium">BB</th>
                <th className="numeral px-2 py-2 font-medium">SO</th>
              </tr>
            </thead>
            <tbody>
              {side.pitchers.map((p) => (
                <PitcherRow key={p.id} p={p} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function BatterRow({ b }: { b: MlbBoxscoreBatter }) {
  return (
    <tr className="border-t border-white/[0.04]">
      <td className="px-3 py-1.5">
        <Link to={`/sports/mlb/player/${b.id}`} className="text-cream hover:text-accent hover:underline">
          {b.name}
        </Link>
        {b.position && <span className="ml-1 text-[10px] text-[#8b93a7]">{b.position}</span>}
      </td>
      <td className="numeral px-2 py-1.5 text-[#c8cdd8]">{b.ab}</td>
      <td className="numeral px-2 py-1.5 text-[#c8cdd8]">{b.r}</td>
      <td className="numeral px-2 py-1.5 text-[#c8cdd8]">{b.h}</td>
      <td className="numeral px-2 py-1.5 text-[#c8cdd8]">{b.rbi}</td>
      <td className="numeral px-2 py-1.5 text-[#c8cdd8]">{b.bb}</td>
      <td className="numeral px-2 py-1.5 text-[#c8cdd8]">{b.so}</td>
    </tr>
  );
}

function PitcherRow({ p }: { p: MlbBoxscorePitcher }) {
  return (
    <tr className="border-t border-white/[0.04]">
      <td className="px-3 py-1.5">
        <Link to={`/sports/mlb/player/${p.id}`} className="text-cream hover:text-accent hover:underline">
          {p.name}
        </Link>
        {p.note && <span className="ml-1 text-[10px] text-[#8b93a7]">({p.note})</span>}
      </td>
      <td className="numeral px-2 py-1.5 text-[#c8cdd8]">{p.ip}</td>
      <td className="numeral px-2 py-1.5 text-[#c8cdd8]">{p.h}</td>
      <td className="numeral px-2 py-1.5 text-[#c8cdd8]">{p.r}</td>
      <td className="numeral px-2 py-1.5 text-[#c8cdd8]">{p.er}</td>
      <td className="numeral px-2 py-1.5 text-[#c8cdd8]">{p.bb}</td>
      <td className="numeral px-2 py-1.5 text-[#c8cdd8]">{p.so}</td>
    </tr>
  );
}
