import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/lib/auth-context";
import {
  getSportsPersonNote,
  upsertSportsPersonNote,
  type SportsEntityType,
} from "@/lib/sports-notes";

export default function SportsNotesPanel({
  entityType,
  entityId,
  entityName,
}: {
  entityType: SportsEntityType;
  entityId: string | number;
  entityName: string;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");

  const note = useQuery({
    queryKey: ["sports-note", user?.id, entityType, String(entityId)],
    queryFn: () => getSportsPersonNote(user!.id, entityType, entityId),
    enabled: Boolean(user?.id && entityId),
  });

  useEffect(() => {
    if (note.data) setDraft(note.data.content);
    else if (note.isSuccess) setDraft("");
  }, [note.data, note.isSuccess]);

  const save = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Not signed in");
      return upsertSportsPersonNote({
        userId: user.id,
        entityType,
        entityId,
        content: draft.trim(),
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ["sports-note", user?.id, entityType, String(entityId)],
      });
      toast.success("Notes saved");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't save notes"),
  });

  if (!user) {
    return (
      <section className="bg-panel rounded-xl border border-white/[0.08] p-4">
        <h2 className="rule-head mb-2">Your notes</h2>
        <p className="text-[13px] text-[#8b93a7]">Sign in to keep private notes on {entityName}.</p>
      </section>
    );
  }

  return (
    <section className="bg-panel rounded-xl border border-white/[0.08] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="rule-head">Your notes</h2>
        {note.isFetching && <Loader2 size={14} className="text-chalk-dim animate-spin" />}
      </div>
      <p className="mb-2 text-[12px] text-[#8b93a7]">
        Private notes about {entityName} — only you can see these.
      </p>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={5}
        placeholder="Scout notes, contract thoughts, watch list…"
        className="bg-ink/40 text-cream placeholder:text-chalk-dim w-full resize-y rounded-lg border border-white/10 px-3 py-2.5 text-[13.5px] leading-relaxed outline-none focus:border-accent/50"
      />
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-[11px] text-[#8b93a7]">
          {note.data?.updatedAt
            ? `Updated ${new Date(note.data.updatedAt).toLocaleString()}`
            : "Not saved yet"}
        </p>
        <button
          type="button"
          onClick={() => save.mutate()}
          disabled={save.isPending || draft === (note.data?.content ?? "")}
          className="from-accent-deep to-accent-dark text-cream rounded-sm bg-gradient-to-b px-3 py-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] disabled:opacity-40"
        >
          {save.isPending ? "Saving…" : "Save notes"}
        </button>
      </div>
    </section>
  );
}
