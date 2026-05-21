"use client";

import { motion } from "framer-motion";
import type { Metrics } from "@/lib/types";

interface Props {
  metrics: Metrics;
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col"
    >
      <span className="text-[11px] uppercase tracking-wider text-[#71717a]">
        {label}
      </span>
      <span className="text-2xl font-semibold tabular-nums mt-0.5">
        {value}
      </span>
    </motion.div>
  );
}

export function AgencyKPIBar({ metrics: m }: Props) {
  function fmt(n: number, prefix = ""): string {
    if (n >= 1_000_000) return `${prefix}${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 100_000) return `${prefix}${(n / 1000).toFixed(0)}K`;
    if (n >= 1000) return `${prefix}${(n / 1000).toFixed(1)}K`;
    return `${prefix}${n.toFixed(0)}`;
  }

  return (
    <div className="flex gap-8 px-6 py-4 border-b border-[#27272a]">
      <Tile label="Total Spend" value={fmt(m.spend, "₹")} />
      <Tile label="Results" value={m.results > 0 ? fmt(m.results) : "—"} />
      <Tile label="Avg CPR" value={m.cpr ? fmt(m.cpr, "₹") : "—"} />
      <Tile label="Avg ROAS" value={m.roas ? `${m.roas.toFixed(2)}×` : "—"} />
    </div>
  );
}
