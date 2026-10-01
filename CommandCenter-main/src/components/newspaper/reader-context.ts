import { createContext, useContext } from "react";
import type { BoxGame } from "@/lib/newspaper-box";
import type { GameWrapCard } from "@/lib/newspaper-sports";

export type ReaderStory = {
  card: GameWrapCard;
  game?: BoxGame | null;
  color?: string | null;
};

export const ReaderContext = createContext<((story: ReaderStory) => void) | null>(null);

/** Opens a story in the paper's own reader instead of leaving for the website. */
export function useReader(): (story: ReaderStory) => void {
  return useContext(ReaderContext) ?? (() => undefined);
}
