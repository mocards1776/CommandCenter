import { useLayoutEffect, useRef, useState } from "react";
import { PHONE_CARD_SIZE } from "@/lib/newspaper-phone-cards";

/**
 * Drop lower-priority pieces until the phone card's content fits 430×932.
 * Never shrink type — the caller trims items. Overflow is still clipped in CSS.
 */
export function usePhoneCardFit<T>(initial: T, trim: (current: T) => T | null, resetKey: string) {
  const ref = useRef<HTMLElement | null>(null);
  const [value, setValue] = useState(initial);
  const [key, setKey] = useState(resetKey);

  if (key !== resetKey) {
    setKey(resetKey);
    setValue(initial);
  }

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fits = el.scrollHeight <= PHONE_CARD_SIZE.height + 0.5;
    if (fits) {
      el.setAttribute("data-phone-fit", "1");
      return;
    }
    const next = trim(value);
    if (!next) {
      el.setAttribute("data-phone-fit", "1");
      return;
    }
    el.removeAttribute("data-phone-fit");
    setValue(next);
  }, [value, key, trim]);

  return { ref, value };
}
