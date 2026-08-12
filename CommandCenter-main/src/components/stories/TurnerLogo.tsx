/** Mark Turner Market Research wordmark with portrait mark. */
export default function TurnerLogo({
  className = "",
  compact = false,
  stacked = false,
}: {
  className?: string;
  compact?: boolean;
  stacked?: boolean;
}) {
  const photo = (
    <img
      src="/brand/mark-turner.png"
      alt=""
      className="turner-photo"
      width={compact ? 40 : 52}
      height={compact ? 40 : 52}
    />
  );

  if (compact) {
    return (
      <span className={`turner-logo is-compact ${className}`} aria-label="Mark Turner Market Research">
        {photo}
      </span>
    );
  }

  if (stacked) {
    return (
      <div className={`turner-logo is-stacked ${className}`}>
        {photo}
        <div className="turner-text">
          <strong>Mark Turner</strong>
          <span>Market Research</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`turner-logo ${className}`} aria-label="Mark Turner Market Research">
      {photo}
      <div className="turner-text">
        <strong>Mark Turner</strong>
        <span>Market Research</span>
      </div>
    </div>
  );
}
