"use client";

import { useFilters, type DateRange } from "@/hooks/useFilters";
import type { AccountMeta } from "@/lib/types";

interface Props {
  accounts: AccountMeta[];
}

const RANGES: { label: string; value: DateRange }[] = [
  { label: "7D", value: "7d" },
  { label: "14D", value: "14d" },
  { label: "30D", value: "30d" },
];

export function FilterBar({ accounts }: Props) {
  const [filters, setFilters] = useFilters();

  return (
    <div className="sticky top-0 z-20 flex items-center gap-4 px-6 py-3 border-b border-[#27272a] bg-[#09090b]/90 backdrop-blur-sm">
      {/* Date range */}
      <div className="flex items-center gap-1 rounded-lg border border-[#27272a] p-0.5">
        {RANGES.map((r) => (
          <button
            key={r.value}
            onClick={() => setFilters({ range: r.value })}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              filters.range === r.value
                ? "bg-[#27272a] text-[#fafafa]"
                : "text-[#71717a] hover:text-[#fafafa]"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Account filter — only shown when portfolio has multiple accounts */}
      {accounts.length > 1 && (
        <select
          value={filters.accountId ?? ""}
          onChange={(e) =>
            setFilters({ accountId: e.target.value || null })
          }
          className="text-xs bg-[#18181b] border border-[#27272a] rounded-lg px-3 py-1.5 text-[#d4d4d8] focus:outline-none focus:border-[#52525b]"
        >
          <option value="">All accounts</option>
          {accounts.map((a) => (
            <option key={a.account_id} value={a.account_id}>
              {a.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
