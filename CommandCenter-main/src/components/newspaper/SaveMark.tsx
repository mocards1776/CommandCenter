import { Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GameWrapCard } from "@/lib/newspaper-sports";
import { useSavedArticles } from "./saved-context";

export function SaveMark({
  card,
  className,
  label,
}: {
  card: GameWrapCard;
  className?: string;
  label?: string;
}) {
  const { isSaved, toggle } = useSavedArticles();
  const saved = isSaved(card.id);
  return (
    <button
      type="button"
      className={cn("tt-save", saved && "is-saved", className)}
      aria-pressed={saved}
      aria-label={saved ? "Unsave story" : "Save for later"}
      title={saved ? "Saved" : "Save for later"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(card);
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <Bookmark size={14} strokeWidth={1.75} fill={saved ? "currentColor" : "none"} />
      {label ? <span>{saved ? "Saved" : label}</span> : null}
    </button>
  );
}

export function HeadlineSave({
  card,
  children,
  className,
}: {
  card: GameWrapCard;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("tt-hl-save", className)}>
      <span className="tt-hl-save-text">{children}</span>
      <SaveMark card={card} />
    </span>
  );
}
