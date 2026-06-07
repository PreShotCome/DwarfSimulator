import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Sample } from '../hooks/useSource';
import { formatHashrate } from '../format';

/** Aggregate hash-rate trend for the active miner (built client-side). */
export function RateChart({
  samples,
  accent,
}: {
  samples: Sample[];
  accent: string;
}) {
  if (samples.length < 2) {
    return (
      <p className="muted">
        Collecting data… the trend appears after a couple of updates.
      </p>
    );
  }

  const data = samples.map((sample) => ({
    time: new Date(sample.ts).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    }),
    hashrate: sample.hashrate,
  }));

  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="#222630" />
          <XAxis dataKey="time" stroke="#7a8290" fontSize={11} minTickGap={32} />
          <YAxis
            stroke="#7a8290"
            fontSize={11}
            width={84}
            tickFormatter={(value: number) => formatHashrate(value)}
          />
          <Tooltip
            formatter={(value: number) => formatHashrate(value)}
            contentStyle={{
              background: '#161a22',
              border: '1px solid #2a2f3a',
              borderRadius: 8,
              color: '#e6e9ef',
            }}
          />
          <Line
            type="monotone"
            dataKey="hashrate"
            stroke={accent}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
