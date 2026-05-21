"use client";

import { motion } from "framer-motion";
import { useCountUp } from "@/hooks/useCountUp";
import type { Metrics } from "@/lib/types";

interface Props {
  metrics: Metrics;
}

function fmtCurrency(n: number): string {
  if (n >= 1_000_000) return `₹${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 100_000) return `₹${(n / 1000).toFixed(0)}K`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toFixed(0)}`;
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toFixed(0);
}

function Tile({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: "good" | "bad" | "neutral";
}) {
  const color =
    highlight === "good"
      ? "text-green-400"
      : highlight === "bad"
      ? "text-red-400"
      : "text-[#fafafa]";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#09090b] px-5 py-4 flex flex-col"
    >
      <span className="text-[11px] uppercase tracking-wider text-[#71717a] mb-1">
        {label}
      </span>
      <span className={`text-2xl font-semibold tabular-nums ${color}`}>
        {value}
      </span>
      {sub && (
        <span className="text-[11px] text-[#52525b] mt-0.5">{sub}</span>
      )}
    </motion.div>
  );
}

function AnimatedCurrency({ value }: { value: number }) {
  const v = useCountUp(value);
  return <>{fmtCurrency(v)}</>;
}

function AnimatedNum({ value }: { value: number }) {
  const v = useCountUp(value);
  return <>{fmtNum(v)}</>;
}

export function KPITileGrid({ metrics: m }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-[#27272a] border-b border-[#27272a]">
      <Tile
        label="Spend"
        value={m.spend > 0 ? fmtCurrency(m.spend) : "—"}
      />
      <Tile
        label="Results"
        value={m.results > 0 ? fmtNum(m.results) : "—"}
      />
      <Tile
        label="CPR"
        value={m.cpr ? fmtCurrency(m.cpr) : "—"}
      />
      <Tile
        label="ROAS"
        value={m.roas ? `${m.roas.toFixed(2)}×` : "—"}
      />
      <Tile
        label="CTR"
        value={m.ctr > 0 ? `${m.ctr.toFixed(2)}%` : "—"}
      />
      <Tile
        label="CPC"
        value={m.cpc ? fmtCurrency(m.cpc) : "—"}
      />
      <Tile
        label="CPM"
        value={m.cpm > 0 ? fmtCurrency(m.cpm) : "—"}
      />
      <Tile
        label="Frequency"
        value={m.frequency > 0 ? m.frequency.toFixed(2) : "—"}
      />
    </div>
  );
}
