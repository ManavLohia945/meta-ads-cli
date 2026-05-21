"use client";

import { motion } from "framer-motion";

interface CampaignPace {
  id: string;
  name: string;
  spend: number;
  budget: number;
  daysElapsed: number;
  totalDays: number;
}

interface Props {
  campaigns: CampaignPace[];
}

function fmtCurrency(n: number): string {
  if (n >= 100_000) return `₹${(n / 1000).toFixed(0)}K`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toFixed(0)}`;
}

export function BudgetPacingStrip({ campaigns }: Props) {
  if (!campaigns.length) return null;

  return (
    <div className="flex flex-col gap-3">
      {campaigns.map((c) => {
        const expectedPct = c.totalDays > 0 ? c.daysElapsed / c.totalDays : 0;
        const actualPct = c.budget > 0 ? c.spend / c.budget : 0;
        const burnRatio = expectedPct > 0 ? actualPct / expectedPct : null;

        // Color: green if pacing ±20%, yellow if slow, red if overpacing
        const color =
          burnRatio === null
            ? "#3f3f46"
            : burnRatio > 1.2
            ? "#ef4444"
            : burnRatio < 0.8
            ? "#f59e0b"
            : "#22c55e";

        return (
          <div key={c.id}>
            <div className="flex items-center justify-between mb-1">
              <span
                className="text-xs text-[#d4d4d8] truncate max-w-[200px]"
                title={c.name}
              >
                {c.name}
              </span>
              <span className="text-[11px] text-[#71717a] tabular-nums shrink-0 ml-2">
                {fmtCurrency(c.spend)} / {fmtCurrency(c.budget)}
              </span>
            </div>
            <div className="relative h-1.5 bg-[#27272a] rounded-full overflow-hidden">
              {/* Expected pace marker */}
              <div
                className="absolute top-0 bottom-0 w-px bg-[#52525b] z-10"
                style={{ left: `${Math.min(expectedPct * 100, 100)}%` }}
              />
              {/* Actual spend bar */}
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: color }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(actualPct * 100, 100)}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
