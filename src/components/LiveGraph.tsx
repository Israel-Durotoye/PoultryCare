import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts';
import { TrendingUp, BarChart2, Activity } from 'lucide-react';
import type { LogEntry } from '../types';

interface LiveGraphProps {
  logs: LogEntry[];
}

const PRIMARY   = 'hsl(142.1, 76.2%, 36.3%)';
const DANGER    = 'hsl(346.8, 77.2%, 49.8%)';
const GRID_CLR  = 'rgba(0,0,0,0.05)';

const EmptyState = () => (
  <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
    <Activity className="h-8 w-8 opacity-30" />
    <p className="text-sm font-medium">Run an analysis to populate this chart</p>
  </div>
);

export function LiveGraph({ logs }: LiveGraphProps) {
  /* ── Line chart: confidence per run ── */
  const lineData = logs.map((log, i) => ({
    run: `#${i + 1}`,
    Audio: log.type === 'audio' ? parseFloat((log.confidence * 100).toFixed(1)) : undefined,
    Image: log.type === 'image' ? parseFloat((log.confidence * 100).toFixed(1)) : undefined,
  }));

  /* ── Bar chart: outcome label counts ── */
  const counts: Record<string, { Audio: number; Image: number }> = {};
  logs.forEach((log) => {
    const key = log.label.charAt(0).toUpperCase() + log.label.slice(1).toLowerCase();
    if (!counts[key]) counts[key] = { Audio: 0, Image: 0 };
    if (log.type === 'audio') counts[key].Audio += 1;
    else counts[key].Image += 1;
  });
  const barData = Object.entries(counts).map(([name, v]) => ({ name, ...v }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

      {/* ── Confidence Trend ── */}
      <div className="rounded-3xl bg-card border border-border shadow-elegant p-5 sm:p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-sm">Confidence Trend</h3>
            <p className="text-xs text-muted-foreground">AI confidence % per analysis run</p>
          </div>
          {logs.length > 0 && (
            <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              {logs.length} run{logs.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {logs.length === 0 ? <EmptyState /> : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={lineData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_CLR} />
              <XAxis
                dataKey="run"
                tick={{ fontSize: 11, fill: 'hsl(143 15% 40%)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: 'hsl(143 15% 40%)' }}
                tickFormatter={(v) => `${v}%`}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: '1px solid hsl(143 20% 90%)', fontSize: 12 }}
                formatter={(v) => [`${v}%`, '']}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="Audio"
                stroke={PRIMARY}
                strokeWidth={2.5}
                dot={{ r: 5, fill: PRIMARY, strokeWidth: 0 }}
                activeDot={{ r: 7 }}
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="Image"
                stroke={DANGER}
                strokeWidth={2.5}
                dot={{ r: 5, fill: DANGER, strokeWidth: 0 }}
                activeDot={{ r: 7 }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Outcome Breakdown ── */}
      <div className="rounded-3xl bg-card border border-border shadow-elegant p-5 sm:p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <BarChart2 className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-sm">Outcome Breakdown</h3>
            <p className="text-xs text-muted-foreground">Diagnosis label frequency</p>
          </div>
        </div>

        {logs.length === 0 ? <EmptyState /> : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_CLR} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: 'hsl(143 15% 40%)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: 'hsl(143 15% 40%)' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: '1px solid hsl(143 20% 90%)', fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Audio" fill={PRIMARY} radius={[5, 5, 0, 0]} />
              <Bar dataKey="Image" fill={DANGER}   radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

    </div>
  );
}
