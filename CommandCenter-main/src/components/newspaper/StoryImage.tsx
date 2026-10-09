import { useState } from "react";
import { storyImageCandidates } from "@/lib/newspaper-images";

/**
 * First candidate, then the other on error (BLOX keeps its stored `.preview`
 * first). If both fail the picture stays mounted at its reserved size, so A1
 * keeps its height and does not re-fit. `_onFail` is never called (callers
 * that would unmount on failure keep their art).
 */
export function useStoryImage(url: string | null | undefined, _onFail?: () => void) {
  const { src: primary, fallback } = storyImageCandidates(url);
  const key = url ?? "";
  const [tracked, setTracked] = useState(key);
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  if (tracked !== key) {
    setTracked(key);
    setStage(0);
  }
  const src = stage >= 1 && fallback ? fallback : primary;
  const hidden = !primary;
  const failed = stage === 2;
  const onError = () => {
    if (stage === 0 && fallback) {
      setStage(1);
      return;
    }
    if (stage !== 2) setStage(2);
  };
  return { src, hidden, failed, onError };
}
