import { useLayoutEffect, useRef, useState } from "react";
import { PHONE_CARD_SIZE } from "@/lib/newspaper-phone-cards";

/**
 * Drop lower-priority pieces until the phone card's content fits 430×932.
 * Measure an unconstrained inner body — the clipped article is always 932 tall.
 * Never shrink type — the caller trims items. Overflow is still clipped in CSS.
 */
export function usePhoneCardFit<T>(initial: T, trim: (current: T) => T | null, resetKey: string) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [value, setValue] = useState(initial);
  const [key, setKey] = useState(resetKey);

  if (key !== resetKey) {
    setKey(resetKey);
    setValue(initial);
  }

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const card = el.closest(".tt-phone-card");
    const pad =
      card instanceof HTMLElement
        ? parseFloat(getComputedStyle(card).paddingTop) + parseFloat(getComputedStyle(card).paddingBottom)
        : 0;
    const budget = (card instanceof HTMLElement ? card.clientHeight : PHONE_CARD_SIZE.height) - pad;
    const fits = el.offsetHeight <= budget + 0.5;
    if (fits) {
      card?.setAttribute("data-phone-fit", "1");
      return;
    }
    const next = trim(value);
    if (!next) {
      card?.setAttribute("data-phone-fit", "1");
      return;
    }
    card?.removeAttribute("data-phone-fit");
    setValue(next);
  }, [value, key, trim]);

  return { ref, value };
}
