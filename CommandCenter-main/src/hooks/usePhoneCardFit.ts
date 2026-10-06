import { useLayoutEffect, useRef, useState } from "react";
import { PHONE_CARD_SIZE } from "@/lib/newspaper-phone-cards";

function outerHeight(node: HTMLElement): number {
  const s = getComputedStyle(node);
  return node.offsetHeight + parseFloat(s.marginTop) + parseFloat(s.marginBottom);
}

function bodyBudget(el: HTMLElement): number {
  const card = el.closest(".tt-phone-card");
  const pad =
    card instanceof HTMLElement
      ? parseFloat(getComputedStyle(card).paddingTop) + parseFloat(getComputedStyle(card).paddingBottom)
      : 0;
  let reserve = 0;
  if (card instanceof HTMLElement) {
    for (const child of card.children) {
      if (child === el || !(child instanceof HTMLElement)) continue;
      reserve += outerHeight(child);
    }
  }
  return (card instanceof HTMLElement ? card.clientHeight : PHONE_CARD_SIZE.height) - pad - reserve;
}

/**
 * Drop lower-priority pieces until the phone card's content fits 430×932.
 * Measure an unconstrained inner body — the clipped article is always 932 tall.
 * Sibling footers (credits) stay outside the body and reserve their own height
 * so they are never clipped mid-line. Re-measure after images load so a lead
 * photo cannot push headlines past the clip.
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

    const measure = () => {
      if ([...el.querySelectorAll("img")].some((img) => img.src && !img.complete)) return;
      const budget = bodyBudget(el);
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
    };

    measure();
    const imgs = [...el.querySelectorAll("img")];
    for (const img of imgs) {
      img.addEventListener("load", measure);
      img.addEventListener("error", measure);
    }
    return () => {
      for (const img of imgs) {
        img.removeEventListener("load", measure);
        img.removeEventListener("error", measure);
      }
    };
  }, [value, key, trim]);

  return { ref, value };
}
