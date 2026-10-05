import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { cardFromSaved, snapshotFromCard, type SavedArticle } from "@/lib/newspaper-saved";
import { fetchSavedArticles, saveTimesArticle, unsaveTimesArticle } from "@/lib/newspaper-saved-remote";
import type { GameWrapCard } from "@/lib/newspaper-sports";

type SavedCtx = {
  edition: string;
  articles: SavedArticle[];
  savedIds: Set<string>;
  isSaved: (storyId: string) => boolean;
  toggle: (card: GameWrapCard) => void;
  unsave: (storyId: string) => void;
  cardOf: (row: SavedArticle) => GameWrapCard;
};

const SavedContext = createContext<SavedCtx | null>(null);

export function SavedProvider({ edition, children }: { edition: string; children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const q = useQuery({
    queryKey: ["tt-saved-articles", user?.id],
    queryFn: fetchSavedArticles,
    enabled: Boolean(user?.id),
    staleTime: 30_000,
  });
  const articles = q.data ?? [];
  const savedIds = useMemo(() => new Set(articles.map((row) => row.storyId)), [articles]);

  const saveMut = useMutation({
    mutationFn: (card: GameWrapCard) => saveTimesArticle(snapshotFromCard(card, edition)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tt-saved-articles", user?.id] }),
  });
  const unsaveMut = useMutation({
    mutationFn: (storyId: string) => unsaveTimesArticle(storyId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tt-saved-articles", user?.id] }),
  });

  const toggle = useCallback(
    (card: GameWrapCard) => {
      if (!user?.id) return;
      if (savedIds.has(card.id)) unsaveMut.mutate(card.id);
      else saveMut.mutate(card);
    },
    [savedIds, saveMut, unsaveMut, user?.id],
  );
  const unsave = useCallback(
    (storyId: string) => {
      if (!user?.id) return;
      unsaveMut.mutate(storyId);
    },
    [unsaveMut, user?.id],
  );

  const value = useMemo<SavedCtx>(
    () => ({
      edition,
      articles,
      savedIds,
      isSaved: (storyId) => savedIds.has(storyId),
      toggle,
      unsave,
      cardOf: cardFromSaved,
    }),
    [articles, edition, savedIds, toggle, unsave],
  );

  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>;
}

export function useSavedArticles(): SavedCtx {
  return (
    useContext(SavedContext) ?? {
      edition: "",
      articles: [],
      savedIds: new Set(),
      isSaved: () => false,
      toggle: () => undefined,
      unsave: () => undefined,
      cardOf: cardFromSaved,
    }
  );
}
