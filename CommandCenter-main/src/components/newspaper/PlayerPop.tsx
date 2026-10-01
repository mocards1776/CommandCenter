import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ExternalLink, X } from "lucide-react";
import { nameIndex, namePieces, type Person } from "@/lib/newspaper-people";
import { playerPageHref } from "@/lib/newspaper-players";
import { PeopleContext, PlayerPopContext, usePeople, usePlayerPop } from "./player-context";

function embedHref(href: string): string {
  return `${href}${href.includes("?") ? "&" : "?"}embed=1`;
}

function PlayerSheet({ person, onClose }: { person: Person; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);
  return (
    <div className="tt-pop" role="dialog" aria-modal="true" aria-label={person.name} onClick={onClose}>
      <div className="tt-pop-card" onClick={(e) => e.stopPropagation()}>
        <header className="tt-pop-bar">
          <span className="tt-pop-kicker">The Thompson Times · Player file</span>
          <strong>{person.name}</strong>
          <a href={person.href} className="tt-pop-btn" title="Open the full player page">
            <ExternalLink size={13} /> Full page
          </a>
          <button type="button" className="tt-pop-btn" onClick={onClose} aria-label="Close">
            <X size={14} />
          </button>
        </header>
        <iframe className="tt-pop-frame" src={embedHref(person.href)} title={person.name} />
      </div>
    </div>
  );
}

export function PlayerPopProvider({ people, children }: { people: Person[]; children: ReactNode }) {
  const [open, setOpen] = useState<Person | null>(null);
  const index = useMemo(() => nameIndex(people), [people]);
  const close = useCallback(() => setOpen(null), []);
  return (
    <PlayerPopContext.Provider value={setOpen}>
      <PeopleContext.Provider value={index}>
        {children}
        {open ? <PlayerSheet person={open} onClose={close} /> : null}
      </PeopleContext.Provider>
    </PlayerPopContext.Provider>
  );
}

export function PlayerName({
  name,
  href,
  children,
  className,
}: {
  name: string;
  href: string | null | undefined;
  children?: ReactNode;
  className?: string;
}) {
  const open = usePlayerPop();
  if (!href) return <>{children ?? name}</>;
  return (
    <button
      type="button"
      className={className ? `tt-player ${className}` : "tt-player"}
      onClick={(e) => {
        e.stopPropagation();
        open({ name, href });
      }}
    >
      {children ?? name}
    </button>
  );
}

/** A box-score person, linked when the league's player page knows his id. */
export function PersonName({ path, id, name }: { path: string; id: string | null | undefined; name: string }) {
  return <PlayerName name={name} href={id ? playerPageHref(path, id) : null} />;
}

/** Copy with every known name set as a link to the player's file. */
export function NamedText({ text, seen }: { text: string; seen?: Set<string> }) {
  const index = usePeople();
  const pieces = namePieces(text, index, seen);
  if (pieces.length === 1 && typeof pieces[0] === "string") return <>{text}</>;
  return (
    <>
      {pieces.map((p, i) =>
        typeof p === "string" ? (
          p
        ) : (
          <PlayerName key={i} name={p.person.name} href={p.person.href}>
            {p.text}
          </PlayerName>
        ),
      )}
    </>
  );
}
