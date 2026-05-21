"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";

export type DateRange = "7d" | "14d" | "30d";

export interface Filters {
  range: DateRange;
  accountId: string | null;
}

export function useFilters(): [Filters, (patch: Partial<Filters>) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const filters: Filters = {
    range: (params.get("range") as DateRange) ?? "7d",
    accountId: params.get("account"),
  };

  const setFilters = useCallback(
    (patch: Partial<Filters>) => {
      const next = new URLSearchParams(params.toString());
      if (patch.range !== undefined) next.set("range", patch.range);
      if (patch.accountId !== undefined) {
        if (patch.accountId) next.set("account", patch.accountId);
        else next.delete("account");
      }
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [router, pathname, params]
  );

  return [filters, setFilters];
}
