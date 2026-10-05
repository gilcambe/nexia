export default function ReadinessRing({
  score,
  size = 150,
  stroke = 10,
  label,
  statusColor = 'oklch(var(--primary-500))',
}: {
  score: number;
  size?: number;
  stroke?: number;
  label?: string;
  statusColor?: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="oklch(var(--background-200))"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={statusColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-heading text-3xl font-bold text-foreground-950">{score}</span>
        {label && <span className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-foreground-400">{label}</span>}
      </div>
    </div>
  );
}