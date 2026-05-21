"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Row {
  id: string;
  name: string;
  spend: number;
  results: number;
  cpr: number | null;
  ctr: number;
  impressions: number;
  children?: Row[];
}

interface Props {
  campaigns: Row[];
}

function fmtCurrency(n: number): string {
  if (n >= 100_000) return `₹${(n / 1000).toFixed(0)}K`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toFixed(0)}`;
}

function fmtNum(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toFixed(0);
}

function TableRow({
  row,
  depth,
  index,
}: {
  row: Row;
  depth: number;
  index: number;
}) {
  const [open, setOpen] = useState(false);
  const hasChildren = row.children && row.children.length > 0;

  return (
    <>
      <motion.tr
        initial={{ opacity: 0, x: -4 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.03, duration: 0.2 }}
        className="border-t border-[#27272a] hover:bg-[#18181b] transition-colors group"
      >
        <td className="py-2.5 pr-4">
          <div
            className="flex items-center gap-2"
            style={{ paddingLeft: `${depth * 20}px` }}
          >
            {hasChildren ? (
              <button
                onClick={() => setOpen((o) => !o)}
                className="w-4 h-4 flex items-center justify-center text-[#71717a] hover:text-[#fafafa] transition-colors shrink-0"
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  className={`transition-transform duration-150 ${open ? "rotate-90" : ""}`}
                >
                  <path d="M3 2l4 3-4 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            ) : (
              <span className="w-4 shrink-0" />
            )}
            <span
              className="text-[#d4d4d8] text-sm truncate max-w-[240px]"
              title={row.name}
            >
              {row.name}
            </span>
          </div>
        </td>
        <td className="py-2.5 text-right tabular-nums text-sm">
          {row.spend > 0 ? fmtCurrency(row.spend) : "—"}
        </td>
        <td className="py-2.5 text-right tabular-nums text-sm text-[#a1a1aa]">
          {row.results > 0 ? fmtNum(row.results) : "—"}
        </td>
        <td className="py-2.5 text-right tabular-nums text-sm text-[#a1a1aa]">
          {row.cpr ? fmtCurrency(row.cpr) : "—"}
        </td>
        <td className="py-2.5 text-right tabular-nums text-sm text-[#52525b]">
          {row.ctr > 0 ? `${row.ctr.toFixed(2)}%` : "—"}
        </td>
      </motion.tr>

      <AnimatePresence>
        {open && hasChildren &&
          row.children!.map((child, i) => (
            <TableRow key={child.id} row={child} depth={depth + 1} index={i} />
          ))}
      </AnimatePresence>
    </>
  );
}

export function BreakdownTable({ campaigns }: Props) {
  if (!campaigns.length) {
    return (
      <div className="text-sm text-[#52525b] py-4">
        No campaign data for this period
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[540px]">
        <thead>
          <tr className="text-[#71717a] text-[11px] uppercase tracking-wide">
            <th className="text-left pb-3 font-normal">Campaign / Adset</th>
            <th className="text-right pb-3 font-normal">Spend</th>
            <th className="text-right pb-3 font-normal">Results</th>
            <th className="text-right pb-3 font-normal">CPR</th>
            <th className="text-right pb-3 font-normal">CTR</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c, i) => (
            <TableRow key={c.id} row={c} depth={0} index={i} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
