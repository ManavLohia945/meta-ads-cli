"use client";

import { motion } from "framer-motion";
import type { Anomaly } from "@/lib/anomaly-detection";

interface Props {
  anomalies: Anomaly[];
}

function fmt(n: number, prefix = ""): string {
  if (n >= 1000) return `${prefix}${(n / 1000).toFixed(1)}K`;
  return `${prefix}${n.toFixed(0)}`;
}

export function AnomalyTicker({ anomalies }: Props) {
  if (anomalies.length === 0) return null;

  const items = [...anomalies, ...anomalies]; // duplicate for seamless loop

  return (
    <div className="overflow-hidden border-b border-[#27272a] bg-[#0f0f11] h-9 flex items-center">
      <div className="shrink-0 px-3 text-[10px] uppercase tracking-widest text-[#71717a] border-r border-[#27272a] h-full flex items-center">
        Anomalies
      </div>
      <div className="flex-1 overflow-hidden">
        <motion.div
          className="flex gap-6 whitespace-nowrap"
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: anomalies.length * 4, repeat: Infinity, ease: "linear" }}
        >
          {items.map((a, i) => (
            <span key={i} className="flex items-center gap-2 text-xs shrink-0">
              <span className="text-[#71717a]">{a.portfolioName}</span>
              <span className="font-medium">{a.metric}</span>
              <span
                className={
                  a.direction === "up" ? "text-red-400" : "text-green-400"
                }
              >
                {a.direction === "up" ? "↑" : "↓"}{" "}
                {Math.abs(a.pctChange * 100).toFixed(0)}%
              </span>
              <span className="text-[#52525b]">
                {fmt(a.today, a.metric === "Spend" || a.metric === "CPR" ? "₹" : "")} vs{" "}
                {fmt(a.avg7d, a.metric === "Spend" || a.metric === "CPR" ? "₹" : "")} avg
              </span>
            </span>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
