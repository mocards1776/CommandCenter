/** Brand mark + wordmark (Mark Turner or Thompson Brothers; Market or Financial). */
export default function TurnerLogo({
  className = "",
  compact = false,
  stacked = false,
  brand = "Mark Turner Market Research",
  markSrc = "/brand/mark-turner-market.png",
}: {
  className?: string;
  compact?: boolean;
  stacked?: boolean;
  brand?: string;
  markSrc?: string;
}) {
  const financial = /financial research/i.test(brand);
  const thompson = /thompson brothers/i.test(brand);
  const name = thompson ? "Thompson Brothers" : "Mark Turner";
  const line2 = financial ? "Financial Research" : "Market Research";

  const mark = (
    <img
      src={markSrc}
      alt=""
      className="turner-mark"
      width={compact ? 40 : stacked ? 88 : 56}
      height={compact ? 40 : stacked ? 88 : 56}
    />
  );

  if (compact) {
    return (
      <span className={`turner-logo is-compact ${className}`} aria-label={brand}>
        {mark}
      </span>
    );
  }

  if (stacked) {
    return (
      <div className={`turner-logo is-stacked ${className}`}>
        {mark}
        <div className="turner-text">
          <strong>{name}</strong>
          <span>{line2}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`turner-logo ${className}`} aria-label={brand}>
      {mark}
      <div className="turner-text">
        <strong>{name}</strong>
        <span>{line2}</span>
      </div>
    </div>
  );
}
