import type { StatCard } from '../sources/types';

/** Headline stat cards for the active miner. Fully driven by the source. */
export function SummaryBar({ stats }: { stats: StatCard[] }) {
  if (stats.length === 0) {
    return null;
  }
  return (
    <div className="summary">
      {stats.map((stat) => (
        <div className="stat" key={stat.label}>
          <div className={`stat-value${stat.accent ? ' accent' : ''}`}>
            {stat.value}
          </div>
          <div className="stat-label">{stat.label}</div>
        </div>
      ))}
    </div>
  );
}
