import { useLayoutEffect, useRef, useState } from "react";
import { PHONE_CARD_SIZE, PHONE_FIT_BOTTOM } from "@/lib/newspaper-phone-cards";

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

function lastInkBottom(el: HTMLElement, card: Element | null): number {
  const origin = card instanceof HTMLElement ? card.getBoundingClientRect().top : 0;
  let bottom = 0;
  const walk = (node: Element) => {
    if (node instanceof HTMLElement && node.offsetHeight > 0) {
      bottom = Math.max(bottom, node.getBoundingClientRect().bottom - origin);
    }
    for (const child of node.children) walk(child);
  };
  walk(el);
  return bottom;
}

function assetsReady(el: HTMLElement): boolean {
  if (document.fonts && document.fonts.status === "loading") return false;
  return ![...el.querySelectorAll("img")].some((img) => img.src && !img.complete);
}

/**
 * Drop lower-priority pieces until the phone card's content fits 430×932.
 * Measure only after fonts and images are in, so a late lead photo or a
 * Playfair swap cannot leave a dek cut mid-sentence. Last ink must sit at
 * or above 915 CSS px. Sibling footers reserve their own height.
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
    let cancelled = false;

    const measure = () => {
      if (cancelled) return;
      if (!assetsReady(el)) {
        card?.removeAttribute("data-phone-fit");
        return;
      }
      const budget = bodyBudget(el);
      const bottom = lastInkBottom(el, card);
      const fits = el.offsetHeight <= budget + 0.5 && bottom <= PHONE_FIT_BOTTOM + 0.5;
      card?.setAttribute("data-fit-bottom", String(Math.round(bottom)));
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
    void document.fonts?.ready.then(measure);
    return () => {
      cancelled = true;
      for (const img of imgs) {
        img.removeEventListener("load", measure);
        img.removeEventListener("error", measure);
      }
    };
  }, [value, key, trim]);

  return { ref, value };
}
