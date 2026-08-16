import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Star, X } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/lib/auth-context";
import { addFavoritePlayer } from "@/lib/favorite-players";
import {
  SUGGESTED_PLAYER_TAGS,
  addPlayerTag,
  displayPlayerTag,
  fetchPlayerTags,
  fetchUserTagNames,
  isFavoriteTagName,
  removePlayerTag,
} from "@/lib/sports-player-tags";
import { cn } from "@/lib/utils";

function tagPath(tag: string): string {
  return `/sports/mlb/tags/${encodeURIComponent(tag)}`;
}

function FavoritePill({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-semibold tracking-wide text-amber-100",
        compact
          ? "rounded-full border border-amber-300/30 bg-amber-400/10 px-2 py-0.5 text-[11px]"
          : "rounded-full border border-amber-300/30 bg-amber-400/10 px-2.5 py-1 text-[11px]",
      )}
    >
      <Star size={compact ? 10 : 11} className="fill-current" />
      Favorite
    </span>
  );
}

export default function PlayerTagsPanel({
  playerId,
  playerName,
  variant = "panel",
  isFavorite = false,
  /** When false, tags are not links (e.g. golfers without a tag directory). */
  linkTags = true,
  suggestions,
  teamName,
  teamId,
  position,
  sport,
  league,
}: {
  playerId: string | number;
  playerName: string;
  /** Compact presentation labels for the player hero card. */
  variant?: "panel" | "hero" | "inline";
  isFavorite?: boolean;
  linkTags?: boolean;
  suggestions?: readonly string[];
  teamName?: string | null;
  teamId?: string | number | null;
  position?: string | null;
  sport?: string;
  league?: string;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");

  const tags = useQuery({
    queryKey: ["sports-player-tags", user?.id, String(playerId)],
    queryFn: () => fetchPlayerTags(playerId),
    enabled: Boolean(user?.id && playerId),
  });

  const allTags = useQuery({
    queryKey: ["sports-player-tags-names", user?.id],
    queryFn: fetchUserTagNames,
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  });

  const addMut = useMutation({
    mutationFn: async (tag: string) => {
      if (isFavoriteTagName(tag)) {
        if (!user?.id) throw new Error("Sign in to favorite");
        await addFavoritePlayer({
          userId: user.id,
          playerId: String(playerId),
          playerName,
          teamName: teamName ?? null,
          teamId: teamId != null ? String(teamId) : null,
          position: position ?? null,
          sport: sport ?? "baseball",
          league: league ?? "MLB",
        });
        return { kind: "favorite" as const };
      }
      await addPlayerTag(playerId, tag);
      return { kind: "tag" as const };
    },
    onSuccess: async (result) => {
      setDraft("");
      if (result.kind === "favorite") {
        await qc.invalidateQueries({ queryKey: ["favorite-sports-players"] });
        await qc.invalidateQueries({ queryKey: ["favorite-players"] });
        await qc.invalidateQueries({ queryKey: ["favorite-player"] });
        toast.success("Favorited");
        return;
      }
      await qc.invalidateQueries({
        queryKey: ["sports-player-tags", user?.id, String(playerId)],
      });
      await qc.invalidateQueries({ queryKey: ["sports-player-tags-by-tag"] });
      await qc.invalidateQueries({ queryKey: ["sports-player-tags-names"] });
      await qc.invalidateQueries({ queryKey: ["sports-player-tags-ids"] });
      await qc.invalidateQueries({ queryKey: ["rss-feed-v2"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't add tag"),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => removePlayerTag(id),
    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: ["sports-player-tags", user?.id, String(playerId)],
      });
      await qc.invalidateQueries({ queryKey: ["sports-player-tags-by-tag"] });
      await qc.invalidateQueries({ queryKey: ["sports-player-tags-names"] });
      await qc.invalidateQueries({ queryKey: ["sports-player-tags-ids"] });
      await qc.invalidateQueries({ queryKey: ["rss-feed-v2"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't remove tag"),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    const v = draft.trim();
    if (!v) return;
    addMut.mutate(v);
  }

  const have = new Set((tags.data ?? []).map((t) => t.tag.toLowerCase()));
  const tagList = tags.data ?? [];
  const favoriteTags = tagList.filter((t) => isFavoriteTagName(t.tag));
  const otherTags = tagList.filter((t) => !isFavoriteTagName(t.tag));
  const showFavorite = isFavorite || favoriteTags.length > 0;
  const suggestionPool = [
    ...new Set([...(allTags.data ?? []), ...(suggestions ?? SUGGESTED_PLAYER_TAGS)]),
  ].filter((s) => {
    if (isFavoriteTagName(s)) return !showFavorite;
    return !have.has(s.toLowerCase());
  });

  function renderTagPills(opts?: { compact?: boolean; withRemove?: boolean }) {
    const compact = Boolean(opts?.compact);
    const withRemove = Boolean(opts?.withRemove);
    const pillClass = cn(
      "inline-flex items-center gap-1 border border-sky-300/25 bg-sky-400/10 font-medium tracking-wide text-sky-100",
      compact ? "rounded-md px-2 py-0.5 text-[11px]" : "rounded-md px-2.5 py-1 text-[11px]",
    );
    return (
      <>
        {/* Star Favorite: one pill when favorited — avoid duplicate with legacy #Favorite tags */}
        {isFavorite && <FavoritePill compact={compact} />}
        {!isFavorite && !withRemove && favoriteTags.length > 0 && (
          <FavoritePill compact={compact} />
        )}
        {!isFavorite &&
          withRemove &&
          favoriteTags.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1 rounded-full border border-amber-300/30 bg-amber-400/10 px-2.5 py-1 text-[12px] font-medium text-amber-100"
            >
              <Star size={12} className="fill-current" />
              Favorite
              <button
                type="button"
                onClick={() => removeMut.mutate(t.id)}
                className="rounded p-0.5 text-amber-100/70 transition hover:bg-amber-300/15 hover:text-amber-50"
                aria-label="Remove Favorite tag"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        {otherTags.map((t) =>
          linkTags ? (
            <span key={t.id} className={pillClass}>
              <Link to={tagPath(t.tag)} className="transition hover:underline">
                {displayPlayerTag(t.tag)}
              </Link>
              {withRemove && (
                <button
                  type="button"
                  onClick={() => removeMut.mutate(t.id)}
                  className="rounded p-0.5 text-sky-100/70 transition hover:bg-sky-300/15 hover:text-sky-50"
                  aria-label={`Remove ${t.tag}`}
                >
                  <X size={12} />
                </button>
              )}
            </span>
          ) : (
            <span key={t.id} className={pillClass}>
              {displayPlayerTag(t.tag)}
              {withRemove && (
                <button
                  type="button"
                  onClick={() => removeMut.mutate(t.id)}
                  className="rounded p-0.5 text-sky-100/70 transition hover:bg-sky-300/15 hover:text-sky-50"
                  aria-label={`Remove ${t.tag}`}
                >
                  <X size={12} />
                </button>
              )}
            </span>
          ),
        )}
      </>
    );
  }

  if (variant === "inline") {
    if (!user) return null;
    if (!showFavorite && otherTags.length === 0) return null;
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">{renderTagPills({ compact: true })}</span>
    );
  }

  if (variant === "hero") {
    if (!user) {
      return (
        <div className="mt-4">
          <p className="text-[11px] uppercase tracking-[0.14em] text-white/45">Labels</p>
          <p className="mt-1 text-[12px] text-white/55">Sign in to tag {playerName}.</p>
        </div>
      );
    }

    return (
      <div className="mt-4 space-y-2">
        <p className="text-[11px] uppercase tracking-[0.14em] text-white/45">Labels</p>
        <div className="flex flex-wrap gap-1.5">
          {renderTagPills()}
          {!showFavorite && otherTags.length === 0 && (
            <span className="text-[12px] text-white/45">No labels yet — manage below</span>
          )}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <section className="bg-panel rounded-xl border border-white/[0.08] p-4">
        <h2 className="rule-head mb-2">Manage tags</h2>
        <p className="text-[13px] text-[#8b93a7]">Sign in to tag {playerName}.</p>
      </section>
    );
  }

  return (
    <section className="bg-panel rounded-xl border border-white/[0.08] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="rule-head">Manage tags</h2>
        {(tags.isFetching || allTags.isFetching) && (
          <Loader2 size={14} className="text-chalk-dim animate-spin" />
        )}
      </div>
      <p className="mb-3 text-[12px] text-[#8b93a7]">
        Add or remove private labels. Tap a tag on the player card to see everyone with it.
        Favorite uses the star — typing “Favorite” favorites the player.
      </p>
      <div className="mb-3 flex flex-wrap gap-2">
        {otherTags.length === 0 && favoriteTags.length === 0 && !showFavorite ? (
          <span className="text-chalk-dim text-[12px]">No tags yet.</span>
        ) : (
          renderTagPills({ withRemove: true })
        )}
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {suggestionPool.map((s) => (
          <button
            key={s}
            type="button"
            disabled={addMut.isPending}
            onClick={() => addMut.mutate(s)}
            className="text-chalk hover:text-cream border-white/10 rounded-sm border px-2 py-1 text-[11px] uppercase tracking-[0.12em]"
          >
            {isFavoriteTagName(s) ? (
              <span className="inline-flex items-center gap-1">
                <Star size={10} className="fill-current" /> Favorite
              </span>
            ) : (
              displayPlayerTag(s)
            )}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Custom tag…"
          className="bg-ink/40 text-cream placeholder:text-chalk-dim min-w-0 flex-1 rounded-lg border border-white/10 px-3 py-2 text-[13px] outline-none focus:border-accent/50"
        />
        <button
          type="submit"
          disabled={addMut.isPending || !draft.trim()}
          className={cn(
            "from-accent-deep to-accent-dark text-cream inline-flex items-center gap-1 rounded-sm bg-gradient-to-b px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] disabled:opacity-40",
          )}
        >
          <Plus size={12} />
          Add
        </button>
      </form>
    </section>
  );
}
