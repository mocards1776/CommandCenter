import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Star, X } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/lib/auth-context";
import {
  SUGGESTED_PLAYER_TAGS,
  addPlayerTag,
  displayPlayerTag,
  fetchPlayerTags,
  removePlayerTag,
} from "@/lib/sports-player-tags";
import { cn } from "@/lib/utils";

export default function PlayerTagsPanel({
  playerId,
  playerName,
  variant = "panel",
  isFavorite = false,
}: {
  playerId: string | number;
  playerName: string;
  /** Compact labels for the player hero card. */
  variant?: "panel" | "hero";
  isFavorite?: boolean;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const [openAdd, setOpenAdd] = useState(false);

  const tags = useQuery({
    queryKey: ["sports-player-tags", user?.id, String(playerId)],
    queryFn: () => fetchPlayerTags(playerId),
    enabled: Boolean(user?.id && playerId),
  });

  const addMut = useMutation({
    mutationFn: (tag: string) => addPlayerTag(playerId, tag),
    onSuccess: async () => {
      setDraft("");
      setOpenAdd(false);
      await qc.invalidateQueries({
        queryKey: ["sports-player-tags", user?.id, String(playerId)],
      });
      await qc.invalidateQueries({ queryKey: ["sports-player-tags-by-tag"] });
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
      <div className="mt-4 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] uppercase tracking-[0.14em] text-white/45">Labels</p>
          {tags.isFetching && <Loader2 size={12} className="animate-spin text-white/40" />}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {isFavorite && (
            <span className="inline-flex items-center gap-1 rounded-sm border border-amber-300/35 bg-amber-400/15 px-2 py-1 text-[11px] font-medium text-amber-100">
              <Star size={11} className="fill-current" />
              Favorite
            </span>
          )}
          {tagList.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1 rounded-sm border border-white/20 bg-white/10 px-2 py-1 text-[11px] font-medium text-white"
            >
              {displayPlayerTag(t.tag)}
              <button
                type="button"
                onClick={() => removeMut.mutate(t.id)}
                className="text-white/55 hover:text-white"
                aria-label={`Remove ${t.tag}`}
              >
                <X size={11} />
              </button>
            </span>
          ))}
          {!isFavorite && tagList.length === 0 && (
            <span className="text-[12px] text-white/45">No labels yet</span>
          )}
          {!openAdd && (
            <button
              type="button"
              onClick={() => setOpenAdd(true)}
              className="inline-flex items-center gap-1 rounded-sm border border-dashed border-white/25 px-2 py-1 text-[11px] text-white/70 hover:border-white/45 hover:text-white"
            >
              <Plus size={11} />
              Tag
            </button>
          )}
        </div>
        {openAdd && (
          <div className="space-y-2 rounded-lg border border-white/15 bg-black/25 p-2.5 backdrop-blur-sm">
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_PLAYER_TAGS.filter((s) => !have.has(s.toLowerCase())).map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={addMut.isPending}
                  onClick={() => addMut.mutate(s)}
                  className="rounded-sm border border-white/15 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-white/75 hover:text-white"
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
                className="min-w-0 flex-1 rounded-md border border-white/15 bg-black/30 px-2.5 py-1.5 text-[12px] text-white outline-none placeholder:text-white/35 focus:border-white/40"
              />
              <button
                type="submit"
                disabled={addMut.isPending || !draft.trim()}
                className="rounded-md bg-white/15 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-40"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpenAdd(false);
                  setDraft("");
                }}
                className="rounded-md px-2 py-1.5 text-[11px] text-white/55 hover:text-white"
              >
                Close
              </button>
            </form>
          </div>
        )}
      </div>
    );
  }

  if (!user) {
    return (
      <section className="bg-panel rounded-xl border border-white/[0.08] p-4">
        <h2 className="rule-head mb-2">Tags</h2>
        <p className="text-[13px] text-[#8b93a7]">Sign in to tag {playerName}.</p>
      </section>
    );
  }

  return (
    <section className="bg-panel rounded-xl border border-white/[0.08] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="rule-head">Tags</h2>
        {tags.isFetching && <Loader2 size={14} className="text-chalk-dim animate-spin" />}
      </div>
      <p className="mb-3 text-[12px] text-[#8b93a7]">
        Private labels like #FormerCardinal — only you see these.
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
              {displayPlayerTag(t.tag)}
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
        {SUGGESTED_PLAYER_TAGS.filter((s) => !have.has(s.toLowerCase())).map((s) => (
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
