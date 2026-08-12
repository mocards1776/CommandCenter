/** Mark Turner Market Research wordmark — letterhead / story brand. */
export default function TurnerLogo({
  className = "",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <svg
        className={className}
        viewBox="0 0 40 40"
        width="40"
        height="40"
        aria-hidden
        role="img"
      >
        <title>Mark Turner Market Research</title>
        <rect width="40" height="40" rx="2" fill="#0b1f3a" />
        <path d="M8 28V12h3.2l4.6 9.2L20.4 12H23.6V28h-3.1V17.4L16.2 28h-2.2l-4.3-10.6V28H8z" fill="#f3f5f8" />
        <rect x="26" y="12" width="6" height="16" fill="#c45c26" />
      </svg>
    );
  }

  return (
    <svg
      className={className}
      viewBox="0 0 320 56"
      width="320"
      height="56"
      role="img"
      aria-label="Mark Turner Market Research"
    >
      <rect x="0" y="4" width="48" height="48" rx="2" fill="#0b1f3a" />
      <path
        d="M9.5 40V16h3.8l5.5 11.1L24.4 16H28.2V40h-3.7V24.8L19.4 40h-2.6L11.6 27.2V40H9.5z"
        fill="#f3f5f8"
      />
      <rect x="31" y="16" width="7.5" height="24" fill="#c45c26" />
      <text
        x="62"
        y="28"
        fill="#0b1f3a"
        fontFamily="Georgia, 'Playfair Display', serif"
        fontSize="20"
        fontWeight="700"
        letterSpacing="0.02em"
      >
        Mark Turner
      </text>
      <text
        x="62"
        y="46"
        fill="#5c6578"
        fontFamily="'Libre Franklin', system-ui, sans-serif"
        fontSize="11"
        fontWeight="600"
        letterSpacing="0.22em"
      >
        MARKET RESEARCH
      </text>
    </svg>
  );
}
