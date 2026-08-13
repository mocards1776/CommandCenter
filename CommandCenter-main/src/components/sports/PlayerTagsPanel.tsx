import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Star, X } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/lib/auth-context";
import {
  SUGGESTED_PLAYER_TAGS,
  addPlayerTag,
  displayPlayerTag,
  fetchPlayerTags,
  fetchUserTagNames,
  removePlayerTag,
} from "@/lib/sports-player-tags";
import { cn } from "@/lib/utils";

function tagPath(tag: string): string {
  return `/sports/mlb/tags/${encodeURIComponent(tag)}`;
}

export default function PlayerTagsPanel({
  playerId,
  playerName,
  variant = "panel",
  isFavorite = false,
}: {
  playerId: string | number;
  playerName: string;
  /** Compact presentation labels for the player hero card. */
  variant?: "panel" | "hero";
  isFavorite?: boolean;
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
    mutationFn: (tag: string) => addPlayerTag(playerId, tag),
    onSuccess: async () => {
      setDraft("");
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
  const suggestionPool = [
    ...new Set([...(allTags.data ?? []), ...SUGGESTED_PLAYER_TAGS]),
  ].filter((s) => !have.has(s.toLowerCase()));

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
          {isFavorite && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/30 bg-amber-400/10 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-amber-100">
              <Star size={11} className="fill-current" />
              Favorite
            </span>
          )}
          {tagList.map((t) => (
            <Link
              key={t.id}
              to={tagPath(t.tag)}
              className="inline-flex items-center rounded-full border border-white/25 bg-white/[0.08] px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white transition hover:border-white/45 hover:bg-white/[0.14]"
            >
              {displayPlayerTag(t.tag)}
            </Link>
          ))}
          {!isFavorite && tagList.length === 0 && (
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
      </p>
      <div className="mb-3 flex flex-wrap gap-2">
        {isFavorite && (
          <span className="bg-accent/15 text-accent inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-[12px] font-medium">
            <Star size={12} className="fill-current" />
            Favorite
          </span>
        )}
        {tagList.length === 0 && !isFavorite ? (
          <span className="text-chalk-dim text-[12px]">No tags yet.</span>
        ) : (
          tagList.map((t) => (
            <span
              key={t.id}
              className="bg-accent/15 text-accent inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-[12px] font-medium"
            >
              <Link to={tagPath(t.tag)} className="hover:underline">
                {displayPlayerTag(t.tag)}
              </Link>
              <button
                type="button"
                onClick={() => removeMut.mutate(t.id)}
                className="hover:text-cream"
                aria-label={`Remove ${t.tag}`}
              >
                <X size={12} />
              </button>
            </span>
          ))
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
            {displayPlayerTag(s)}
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
