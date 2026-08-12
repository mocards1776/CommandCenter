/** Mark Turner Market Research — stylized portrait mark + wordmark. */
export default function TurnerLogo({
  className = "",
  compact = false,
  stacked = false,
}: {
  className?: string;
  compact?: boolean;
  stacked?: boolean;
}) {
  const mark = (
    <img
      src="/brand/mark-turner.png"
      alt=""
      className="turner-mark"
      width={compact ? 40 : stacked ? 88 : 56}
      height={compact ? 40 : stacked ? 88 : 56}
    />
  );

  if (compact) {
    return (
      <span className={`turner-logo is-compact ${className}`} aria-label="Mark Turner Market Research">
        {mark}
      </span>
    );
  }

  if (stacked) {
    return (
      <div className={`turner-logo is-stacked ${className}`}>
        {mark}
        <div className="turner-text">
          <strong>Mark Turner</strong>
          <span>Market Research</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`turner-logo ${className}`} aria-label="Mark Turner Market Research">
      {mark}
      <div className="turner-text">
        <strong>Mark Turner</strong>
        <span>Market Research</span>
      </div>
    </div>
  );
}
