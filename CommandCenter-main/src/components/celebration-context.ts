import { createContext, useContext } from "react";

export type CelebrationApi = {
  /** Star burst at a screen coordinate. Fires on every completion. */
  burst: (x: number, y: number) => void;
  /** Full-screen volley plus a line of text. Milestones only. */
  fanfare: (message: string) => void;
};

// Split from <CelebrationProvider> so that file exports only a component —
// otherwise React Fast Refresh drops its state on every edit.
export const CelebrationContext = createContext<CelebrationApi | null>(null);

export function useCelebration(): CelebrationApi {
  // Missing provider shouldn't be able to break completing a task.
  return useContext(CelebrationContext) ?? { burst: () => {}, fanfare: () => {} };
}
