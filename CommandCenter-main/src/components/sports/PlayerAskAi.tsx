import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  askPlayerAi,
  isAskOwner,
  listPlayerAiAnswers,
  sourceLabel,
  type PlayerAiAnswer,
  type PlayerAskContext,
  type PlayerAskSport,
} from "@/lib/player-ask";
import { formatCentralDateTime } from "@/lib/utils";

export function PlayerAskAi({
  sport,
  playerId,
  playerName,
  context,
}: {
  sport: PlayerAskSport;
  playerId: string;
  playerName: string;
  context: PlayerAskContext;
}) {
  const { user } = useAuth();
  const canAsk = isAskOwner(user);
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const qc = useQueryClient();

  const answers = useQuery({
    queryKey: ["player-ai-answers", sport, playerId],
    queryFn: () => listPlayerAiAnswers(sport, playerId),
    enabled: Boolean(playerId),
    staleTime: 30_000,
  });

  const ask = useMutation({
    mutationFn: (text: string) =>
      askPlayerAi({ sport, playerId, question: text, context }),
    onSuccess: async (row) => {
      setQuestion("");
      qc.setQueryData<PlayerAiAnswer[]>(["player-ai-answers", sport, playerId], (prev) => {
        const rest = (prev ?? []).filter((item) => item.id !== row.id);
        return [row, ...rest];
      });
    },
  });

  const count = answers.data?.length ?? 0;
  const fieldId = `ask-ai-${sport}-${playerId}`;

  const submit = () => {
    const text = question.trim();
    if (!text || ask.isPending) return;
    ask.mutate(text);
  };

  return (
    <section className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-white/[0.02]"
        aria-expanded={open}
      >
        <span className="flex min-w-0 items-center gap-2">
          {open ? (
            <ChevronDown size={16} className="text-accent shrink-0" />
          ) : (
            <ChevronRight size={16} className="text-accent shrink-0" />
          )}
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e8e4d9]">
            Ask AI
          </span>
          {count > 0 ? (
            <span className="rounded-md border border-white/15 bg-white/[0.07] px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white/75">
              {count}
            </span>
          ) : null}
        </span>
        <span className="shrink-0 text-[10px] uppercase tracking-[0.14em] text-[#8b93a7]">
          {open ? "Hide" : "Show"}
        </span>
      </button>

      {open ? (
        <div className="space-y-3 border-t border-white/[0.06] px-3.5 py-3.5 sm:px-4">
          {answers.isPending ? (
            <p className="text-chalk-dim flex items-center gap-2 text-[13px]">
              <Loader2 size={14} className="animate-spin" /> Loading saved answers…
            </p>
          ) : null}
          {answers.isError ? (
            <p className="text-alert text-[13px]">Couldn’t load saved answers.</p>
          ) : null}

          {(answers.data ?? []).map((item) => (
            <article
              key={item.id}
              className="rounded-lg border border-white/10 bg-black/25 px-3.5 py-3"
            >
              <p className="text-cream text-[15px] font-medium leading-snug">{item.question}</p>
              <p className="mt-2 text-[15px] leading-relaxed text-[#d7deea]">{item.answer}</p>
              <p className="mt-2.5 text-[12px] text-[#8b93a7]">
                {formatCentralDateTime(item.asked_at)}
              </p>
              {item.sources.length > 0 ? (
                <ul className="mt-1.5 space-y-1">
                  {item.sources.map((source) => (
                    <li key={source.url}>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-accent block text-[12px] leading-snug break-words hover:underline"
                      >
                        {sourceLabel(source)}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))}

          {canAsk ? (
            <form
              className="pt-1"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <label
                htmlFor={fieldId}
                className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8b93a7]"
              >
                Question about {playerName}
              </label>
              <textarea
                id={fieldId}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Injuries, role, recent form…"
                className="bg-ink/40 text-cream placeholder:text-chalk-dim mt-1.5 w-full resize-y rounded-lg border border-white/10 px-3 py-2.5 text-[15px] leading-relaxed outline-none focus:border-accent/50"
              />
              {ask.isError ? (
                <p className="text-alert mt-2 text-[13px]">
                  {ask.error instanceof Error ? ask.error.message : "Could not ask."}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={ask.isPending || !question.trim()}
                className="from-accent-deep to-accent-dark text-cream mt-2.5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-gradient-to-b px-3 py-2.5 text-[12px] font-semibold uppercase tracking-[0.14em] disabled:opacity-40 sm:w-auto sm:px-4"
              >
                {ask.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                {ask.isPending ? "Asking…" : "Ask"}
              </button>
            </form>
          ) : (
            <p className="text-[13px] leading-relaxed text-[#8b93a7]">
              Saved answers stay on this page. New questions are limited to Josh’s account.
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}
