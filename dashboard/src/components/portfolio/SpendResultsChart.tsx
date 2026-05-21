"use client";

import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface ChartPoint {
  date: string;
  spend: number;
  results: number;
}

interface Props {
  data: ChartPoint[];
}

function fmtDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function fmtCurrency(n: number): string {
  if (n >= 100_000) return `₹${(n / 1000).toFixed(0)}K`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toFixed(0)}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#18181b] border border-[#3f3f46] rounded-lg px-3 py-2 text-xs shadow-xl">
      <div className="text-[#71717a] mb-1">{fmtDate(label)}</div>
      {payload.map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (entry: any) => (
          <div key={entry.dataKey} className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: entry.color }}
            />
            <span className="text-[#a1a1aa]">{entry.name}:</span>
            <span className="font-medium text-[#fafafa]">
              {entry.dataKey === "spend"
                ? fmtCurrency(entry.value)
                : entry.value.toFixed(0)}
            </span>
          </div>
        )
      )}
    </div>
  );
}

export function SpendResultsChart({ data }: Props) {
  if (!data.length) {
    return (
      <div className="h-48 flex items-center justify-center text-[#52525b] text-sm">
        No data for this period
      </div>
    );
  }

  const hasResults = data.some((d) => d.results > 0);

  return (
    <ResponsiveContainer width="100%" height={200}>
      <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
        <defs>
          <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#27272a" vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tickFormatter={fmtDate}
          tick={{ fill: "#71717a", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          yAxisId="left"
          orientation="left"
          tickFormatter={(v) => fmtCurrency(v)}
          tick={{ fill: "#71717a", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={56}
        />
        {hasResults && (
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fill: "#71717a", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={32}
          />
        )}
        <Tooltip content={<CustomTooltip />} />
        <Area
          yAxisId="left"
          dataKey="spend"
          name="Spend"
          fill="url(#spendGrad)"
          stroke="#3b82f6"
          strokeWidth={1.5}
          dot={false}
          activeDot={{ r: 3, fill: "#3b82f6" }}
          animationDuration={1200}
        />
        {hasResults && (
          <Line
            yAxisId="right"
            dataKey="results"
            name="Results"
            stroke="#22c55e"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3, fill: "#22c55e" }}
            animationDuration={1200}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
