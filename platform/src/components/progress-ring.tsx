export function ProgressRing({
  value,
  size = 40,
  stroke = 3.5,
  className = '',
  showLabel = true,
}: {
  value: number;
  size?: number;
  stroke?: number;
  className?: string;
  showLabel?: boolean;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = circumference - (clamped / 100) * circumference;
  const done = clamped >= 100;

  return (
    <span
      className={`relative inline-grid place-content-center ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${clamped}% complete`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.09)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={done ? '#34d399' : '#10b981'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.22,1,0.36,1)' }}
        />
      </svg>
      {showLabel ? (
        <span
          className="absolute inset-0 grid place-content-center font-mono tabular-nums"
          style={{ fontSize: size / 3.1 }}
        >
          {done ? '✓' : clamped}
        </span>
      ) : null}
    </span>
  );
}
