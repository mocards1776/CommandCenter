/** Eager A1 lead, lazy everything else. `decoding="async"` keeps the fit pass off the image decode. */
export function paperImgAttrs(eager = false): {
  loading: "eager" | "lazy";
  decoding: "async";
  fetchPriority?: "high";
} {
  if (eager) return { loading: "eager", decoding: "async", fetchPriority: "high" };
  return { loading: "lazy", decoding: "async" };
}
