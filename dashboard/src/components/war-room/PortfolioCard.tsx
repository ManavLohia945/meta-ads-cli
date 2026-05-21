"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { ClientData } from "@/lib/types";
import { rollupMetrics } from "@/lib/compute-metrics";

interface Props {
  slug: string;
  data: ClientData;
  error: string | null;
  index: number;
}

function fmt(n: number, prefix = ""): string {
  if (n >= 100_000) return `${prefix}${(n / 1000).toFixed(0)}K`;
  if (n >= 1000) return `${prefix}${(n / 1000).toFixed(1)}K`;
  return `${prefix}${n.toFixed(0)}`;
}

export function PortfolioCard({ slug, data, error, index }: Props) {
  if (error || !data) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05, duration: 0.3 }}
        className="rounded-xl border border-[#27272a] bg-[#18181b] p-5 flex flex-col gap-2"
      >
        <div className="text-sm text-[#71717a]">{slug}</div>
        <div className="text-xs text-yellow-500 mt-auto">
          {error === "token_error" ? "Token expired" : "No data"}
        </div>
      </motion.div>
    );
  }

  const today = data.daily.at(-1)?.date ?? "";
  const sevenDaysAgo = data.daily.at(-7)?.date ?? today;
  const m = rollupMetrics(data.daily, sevenDaysAgo, today);

  const accountCount = data.meta.accounts.length;
  const hasSpend = m.spend > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      whileHover={{ y: -2, boxShadow: "0 0 0 1px #3f3f46" }}
      layoutId={`card-${slug}`}
    >
      <Link
        href={`/${slug}`}
        className="block rounded-xl border border-[#27272a] bg-[#18181b] p-5 h-full"
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-[#71717a] mb-0.5">
              {accountCount} account{accountCount !== 1 ? "s" : ""}
            </div>
            <div className="font-semibold text-sm leading-tight">
              {data.meta.name}
            </div>
          </div>
          <div
            className={`w-2 h-2 rounded-full mt-1 ${
              hasSpend ? "bg-green-500" : "bg-[#3f3f46]"
            }`}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <Stat label="Spend (7d)" value={fmt(m.spend, "₹")} />
          <Stat label="Results" value={m.results > 0 ? fmt(m.results) : "—"} />
          <Stat
            label="CPR"
            value={m.cpr ? fmt(m.cpr, "₹") : "—"}
          />
          <Stat
            label="ROAS"
            value={m.roas ? `${m.roas.toFixed(2)}×` : "—"}
          />
        </div>
      </Link>
    </motion.div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] text-[#71717a] uppercase tracking-wide mb-0.5">
        {label}
      </div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}
