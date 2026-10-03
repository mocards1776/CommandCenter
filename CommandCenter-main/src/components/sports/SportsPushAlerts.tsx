import { Bell, BellOff, X } from "lucide-react";
import type { SportsLayout } from "@/lib/sports";
import { useSportsPush } from "@/lib/sports-push";
import { cn } from "@/lib/utils";

function Toggle({
  on,
  label,
  detail,
  disabled,
  onChange,
}: {
  on: boolean;
  label: string;
  detail: string;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="bg-panel flex w-full items-center gap-3 rounded border border-white/[0.07] px-3 py-3 text-left disabled:opacity-50"
    >
      <span className="min-w-0 flex-1">
        <span className="text-cream block text-[13px]">{label}</span>
        <span className="text-chalk-dim mt-0.5 block text-[11px] leading-relaxed">{detail}</span>
      </span>
      <span
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition",
          on ? "bg-accent-deep" : "bg-white/15",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-cream transition",
            on ? "left-5" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}

export function SportsPushSettings({ layout }: { layout: SportsLayout }) {
  const push = useSportsPush(layout);
  const blocked = push.permission === "denied";
  const needsHomeScreen = push.ios && !push.standalone;
  const locked = push.busy || blocked || needsHomeScreen;

  return (
    <section className="mb-5">
      <div className="mb-2 flex items-center gap-2">
        <Bell size={14} className="text-accent" />
        <h3 className="text-cream text-[13px] font-semibold uppercase tracking-[0.14em]">Alerts</h3>
      </div>
      <p className="text-chalk-dim mb-3 text-[11.5px] leading-relaxed">
        Heat is on once you allow notifications. Favorite start and final stay off until you
        turn them on. On iPhone, alerts arrive in the Sports app on your Home Screen.
      </p>
      {needsHomeScreen ? (
        <p className="text-chalk mb-3 text-[11.5px] leading-relaxed">
          Open{" "}
          <a href="/sports.html" className="text-accent underline underline-offset-2">
            sports.html
          </a>{" "}
          from the Home Screen icon, then allow alerts there.
        </p>
      ) : null}
      {blocked ? (
        <p className="text-chalk mb-3 text-[11.5px] leading-relaxed">
          Notifications are blocked. On iPhone, turn them on in Settings → Notifications → Sports.
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        <Toggle
          on={push.permission === "granted" && push.subscribed && push.heat}
          label="Heat alerts"
          detail="One push when a live game gets as hot as a one-score game. The note says why — one score, late, extras."
          disabled={locked}
          onChange={(on) => void push.setHeat(on)}
        />
        <Toggle
          on={push.permission === "granted" && push.subscribed && push.favorites}
          label="Favorite start & final"
          detail="Off by default. First pitch, tip-off, or kickoff, and the final, for teams on this board."
          disabled={locked}
          onChange={(on) => void push.setFavoriteAlerts(on)}
        />
      </div>
      {push.error ? <p className="text-alert mt-2 text-[11.5px]">{push.error}</p> : null}
      {push.subscribed ? (
        <button
          type="button"
          onClick={() => void push.stop()}
          disabled={push.busy}
          className="text-chalk-dim hover:text-cream mt-3 flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.14em]"
        >
          <BellOff size={12} />
          Stop alerts
        </button>
      ) : null}
    </section>
  );
}

export function SportsPushBanner({ layout }: { layout: SportsLayout }) {
  const push = useSportsPush(layout);
  const show =
    push.ready &&
    !push.dismissed &&
    !push.subscribed &&
    push.permission !== "denied" &&
    (push.permission !== "granted" || Boolean(push.error));
  if (!show) return null;

  return (
    <div className="border-accent/30 from-hero-lift to-hero relative overflow-hidden rounded-lg border bg-gradient-to-br px-4 py-3.5">
      <button
        type="button"
        aria-label="Dismiss alert prompt"
        onClick={push.dismiss}
        className="text-chalk-dim hover:text-cream absolute right-2 top-2 p-1.5"
      >
        <X size={14} />
      </button>
      <p className="text-accent text-[10px] font-semibold uppercase tracking-[0.16em]">Live heat</p>
      <p className="font-display text-cream mt-1 text-[18px] leading-tight">
        One alert when a game gets hot
      </p>
      <p className="text-chalk mt-1 max-w-md pr-6 text-[12px] leading-relaxed">
        Not every score change, and not the pregame board. The note carries the score and why it
        fired — one score, late, extras.
        {push.ios && !push.standalone
          ? " On iPhone these only arrive in the Home Screen Sports app."
          : ""}
      </p>
      <button
        type="button"
        onClick={() => void push.enable()}
        disabled={push.busy}
        className="from-accent-deep to-accent-dark text-cream mt-3 rounded-sm bg-gradient-to-b px-3 py-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] disabled:opacity-50"
      >
        {push.busy ? "Turning on…" : push.ios && !push.standalone ? "Use the Home Screen app" : "Allow alerts"}
      </button>
      {push.error ? <p className="text-alert mt-2 text-[11.5px]">{push.error}</p> : null}
    </div>
  );
}
