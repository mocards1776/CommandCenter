/**
 * One page is one screen. The sheet is always set at PAGE_W design pixels
 * (the iPad Pro 13" in portrait), so type and columns never reflow between
 * devices. Its height comes from the window alone, never from the copy:
 * a taller window gets a taller page, inside the [PAGE_H_MIN, PAGE_H_MAX]
 * band the templates are built for, and the whole page scales to fit.
 */
export const PAGE_W = 1032;
export const PAGE_H_MIN = 1100;
export const PAGE_H_MAX = 1400;

export type PageGeometry = {
  /** Design height of the sheet, in px at scale 1. */
  height: number;
  /** Uniform scale that puts the whole sheet on screen. */
  scale: number;
};

export function pageGeometry(availW: number, availH: number): PageGeometry {
  if (!(availW > 0) || !(availH > 0)) return { height: PAGE_H_MIN, scale: 1 };
  const byWidth = Math.min(1, availW / PAGE_W);
  const height = Math.round(Math.min(PAGE_H_MAX, Math.max(PAGE_H_MIN, availH / byWidth)));
  const scale = Math.min(byWidth, availH / height);
  return { height, scale: Math.floor(scale * 10_000) / 10_000 };
}
