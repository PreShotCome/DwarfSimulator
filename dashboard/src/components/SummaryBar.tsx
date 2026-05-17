import type { Summary } from '../api';
import { formatHashrate, formatNumber } from '../format';

const EMPTY: Summary = {
  workerCount: 0,
  onlineCount: 0,
  totalHashrate: 0,
  totalAccepted: 0,
  totalRejected: 0,
};

export function SummaryBar({ summary }: { summary: Summary | null }) {
  const s = summary ?? EMPTY;
  return (
    <div className="summary">
      <Stat label="Total hashrate" value={formatHashrate(s.totalHashrate)} accent />
      <Stat label="Workers online" value={`${s.onlineCount} / ${s.workerCount}`} />
      <Stat label="Accepted shares" value={formatNumber(s.totalAccepted)} />
      <Stat label="Rejected shares" value={formatNumber(s.totalRejected)} />
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="stat">
      <div className={`stat-value${accent ? ' accent' : ''}`}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
