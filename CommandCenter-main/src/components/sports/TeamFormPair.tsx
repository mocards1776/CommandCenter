import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import TeamMark from "@/components/sports/TeamMark";
import {
  fetchMlbTeamForm,
  fetchNflTeamForm,
  type TeamFormStrip,
} from "@/lib/team-form";
import { teamPagePath } from "@/lib/mlb";

function FormCard({
  form,
  sport,
}: {
  form: TeamFormStrip;
  sport: "mlb" | "nfl";
}) {
  const href =
    sport === "mlb"
      ? teamPagePath(Number(form.teamId))
      : `/sports/nfl/team/${form.teamId}`;
  return (
    <Link
      to={href}
      className="bg-panel hover:border-accent/40 block rounded-xl border border-white/[0.08] px-3 py-3 transition"
    >
      <div className="flex items-center gap-2">
        {sport === "mlb" ? (
          <TeamMark teamId={Number(form.teamId)} size="sm" />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="text-cream truncate text-[13px] font-semibold">
            {form.abbrev || form.name}
          </p>
          <p className="text-chalk-dim text-[11px]">
            {[form.record, form.standing].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>
      </div>
      <dl className="mt-2.5 grid grid-cols-3 gap-2 text-center">
        {[
          ["L5", form.last5],
          ["L10", form.last10],
          ["L20", form.last20],
        ].map(([label, value]) => (
          <div key={label} className="rounded-md bg-white/[0.03] px-1 py-1.5">
            <dt className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#8b93a7]">
              {label}
            </dt>
            <dd className="numeral text-cream mt-0.5 text-[13px]">{value}</dd>
          </div>
        ))}
      </dl>
    </Link>
  );
}

export function MlbTeamFormPair({
  awayId,
  homeId,
}: {
  awayId: number;
  homeId: number;
}) {
  const away = useQuery({
    queryKey: ["mlb-team-form", awayId],
    queryFn: () => fetchMlbTeamForm(awayId),
    enabled: awayId > 0,
    staleTime: 120_000,
  });
  const home = useQuery({
    queryKey: ["mlb-team-form", homeId],
    queryFn: () => fetchMlbTeamForm(homeId),
    enabled: homeId > 0,
    staleTime: 120_000,
  });
  if (!away.data && !home.data) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
        Standings & form
      </h2>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {away.data ? <FormCard form={away.data} sport="mlb" /> : null}
        {home.data ? <FormCard form={home.data} sport="mlb" /> : null}
      </div>
    </section>
  );
}

export function NflTeamFormPair({
  awayId,
  homeId,
  awayAbbrev,
  homeAbbrev,
}: {
  awayId: number | string;
  homeId: number | string;
  awayAbbrev?: string;
  homeAbbrev?: string;
}) {
  const away = useQuery({
    queryKey: ["nfl-team-form", awayId],
    queryFn: () => fetchNflTeamForm(awayId, awayAbbrev),
    enabled: Boolean(awayId),
    staleTime: 120_000,
  });
  const home = useQuery({
    queryKey: ["nfl-team-form", homeId],
    queryFn: () => fetchNflTeamForm(homeId, homeAbbrev),
    enabled: Boolean(homeId),
    staleTime: 120_000,
  });
  if (!away.data && !home.data) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
        Standings & form
      </h2>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {away.data ? <FormCard form={away.data} sport="nfl" /> : null}
        {home.data ? <FormCard form={home.data} sport="nfl" /> : null}
      </div>
    </section>
  );
}
