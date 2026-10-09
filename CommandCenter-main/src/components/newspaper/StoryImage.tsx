import { useState } from "react";
import { storyImageCandidates } from "@/lib/newspaper-images";

/**
 * Upgraded art first (BLOX `.image`, decoded `&amp;`). On error, the stored
 * URL. If that fails too, the picture unmounts so the gray box does not stay.
 */
export function useStoryImage(url: string | null | undefined, onFail?: () => void) {
  const { src: primary, fallback } = storyImageCandidates(url);
  const key = url ?? "";
  const [tracked, setTracked] = useState(key);
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  if (tracked !== key) {
    setTracked(key);
    setStage(0);
  }
  const src = stage === 1 && fallback ? fallback : primary;
  const hidden = !primary || stage === 2;
  const onError = () => {
    if (stage === 0 && fallback) {
      setStage(1);
      return;
    }
    setStage(2);
    onFail?.();
  };
  return { src, hidden, onError };
}
