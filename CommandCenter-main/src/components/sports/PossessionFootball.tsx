/** Small American-football mark for possession indicators. */
export default function PossessionFootball({
  className,
  title = "Possession",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 20 12"
      className={className}
      aria-label={title}
      role="img"
    >
      {/* Pointed football body */}
      <path
        d="M2.2 6 C2.2 2.8 6.2 1 10 1 C13.8 1 17.8 2.8 17.8 6 C17.8 9.2 13.8 11 10 11 C6.2 11 2.2 9.2 2.2 6 Z"
        fill="#c4a574"
        stroke="#f5efe4"
        strokeWidth="0.9"
      />
      <path
        d="M2.8 6 C2.8 3.4 6.4 1.85 10 1.85 C13.6 1.85 17.2 3.4 17.2 6 C17.2 8.6 13.6 10.15 10 10.15 C6.4 10.15 2.8 8.6 2.8 6 Z"
        fill="#8b5a2b"
      />
      {/* Center stripe + laces */}
      <path d="M7 6 H13" stroke="#f5efe4" strokeWidth="0.85" strokeLinecap="round" />
      {[8, 9, 10, 11, 12].map((x) => (
        <path
          key={x}
          d={`M${x} 4.55 V7.45`}
          stroke="#f5efe4"
          strokeWidth="0.7"
          strokeLinecap="round"
        />
      ))}
      {/* Tip shadows */}
      <ellipse cx="3.6" cy="6" rx="1.1" ry="1.7" fill="#3d2410" opacity="0.45" />
      <ellipse cx="16.4" cy="6" rx="1.1" ry="1.7" fill="#3d2410" opacity="0.45" />
    </svg>
  );
}
