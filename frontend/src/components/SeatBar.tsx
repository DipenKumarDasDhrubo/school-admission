interface Props {
  total: number;
  held: number;
  confirmed: number;
}

/** Proportional bar: confirmed (solid), on hold (hatched), available (empty). */
export function SeatBar({ total, held, confirmed }: Props) {
  const pct = (n: number) => (total > 0 ? Math.min(100, (n / total) * 100) : 0);
  const available = Math.max(0, total - held - confirmed);
  return (
    <div
      className="seatbar"
      role="img"
      aria-label={`${confirmed} confirmed, ${held} on hold, ${available} available, out of ${total} seats`}
    >
      <span className="seg seg-confirmed" style={{ width: `${pct(confirmed)}%` }} />
      <span className="seg seg-held" style={{ width: `${pct(held)}%` }} />
    </div>
  );
}
