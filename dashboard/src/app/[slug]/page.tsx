import { notFound } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { loadPortfolio } from "@/lib/data-loader";
import { computeMetrics } from "@/lib/compute-metrics";
import { FilterBar } from "@/components/portfolio/FilterBar";
import { KPITileGrid } from "@/components/portfolio/KPITileGrid";
import { SpendResultsChart } from "@/components/portfolio/SpendResultsChart";
import { BreakdownTable } from "@/components/portfolio/BreakdownTable";
import { BudgetPacingStrip } from "@/components/portfolio/BudgetPacingStrip";
import type { InsightRow, DailyEntry } from "@/lib/types";

function num(v: string | undefined): number {
  return v ? parseFloat(v) : 0;
}

function mergeRows(rows: InsightRow[]): InsightRow {
  const m: InsightRow = {};
  for (const r of rows) {
    if (!r.spend) continue;
    m.spend = String(num(m.spend) + num(r.spend));
    m.impressions = String(num(m.impressions) + num(r.impressions));
    m.inline_link_clicks = String(num(m.inline_link_clicks) + num(r.inline_link_clicks));
    m.reach = String(num(m.reach) + num(r.reach));
    if (r.actions) {
      const acc = m.actions ?? [];
      for (const a of r.actions) {
        const ex = acc.find((x) => x.action_type === a.action_type);
        if (ex) ex.value = String(num(ex.value) + num(a.value));
        else acc.push({ ...a });
      }
      m.actions = acc;
    }
    if (r.purchase_roas?.length) m.purchase_roas = r.purchase_roas;
  }
  return m;
}

function daysInRange(range: string): number {
  if (range === "14d") return 14;
  if (range === "30d") return 30;
  return 7;
}

function getWindow(daily: DailyEntry[], range: string): [string, string] {
  const sorted = [...daily].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted.at(-1)?.date ?? "";
  const days = daysInRange(range);
  const from = sorted.at(-days)?.date ?? latest;
  return [from, latest];
}

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ range?: string; account?: string }>;
}

export default async function PortfolioPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { range = "7d", account } = await searchParams;

  const data = loadPortfolio(slug);
  if (!data) notFound();

  const accountIds = account
    ? [account]
    : data.meta.accounts.map((a) => a.account_id);

  const [since, until] = getWindow(data.daily, range);
  const days = daysInRange(range);

  // Collect all account-level rows for the date window
  const allRows: InsightRow[] = [];
  for (const day of data.daily) {
    if (day.date < since || day.date > until) continue;
    for (const [aid, acct] of Object.entries(day.accounts)) {
      if (!accountIds.includes(aid)) continue;
      if (acct.insights?.spend) allRows.push(acct.insights);
    }
  }
  const metrics = computeMetrics(mergeRows(allRows));

  // Daily spend+results series for chart
  const chartData = data.daily
    .filter((d) => d.date >= since && d.date <= until)
    .map((d) => {
      let spend = 0;
      let results = 0;
      for (const [aid, acct] of Object.entries(d.accounts)) {
        if (!accountIds.includes(aid)) continue;
        spend += num(acct.insights?.spend);
        results += (acct.insights?.actions ?? []).reduce(
          (s, a) => s + num(a.value),
          0
        );
      }
      return { date: d.date, spend, results };
    });

  // Campaign breakdown aggregated over the date window
  const campaignSpend: Record<string, { spend: number; results: number; ctr: number; impressions: number; name: string; days: number }> = {};
  const adsetSpend: Record<string, { spend: number; results: number; ctr: number; impressions: number; name: string; campaignId: string }> = {};

  for (const day of data.daily) {
    if (day.date < since || day.date > until) continue;
    for (const [aid, acct] of Object.entries(day.accounts)) {
      if (!accountIds.includes(aid)) continue;
      for (const [cid, cr] of Object.entries(acct.by_campaign)) {
        if (!campaignSpend[cid]) {
          campaignSpend[cid] = { spend: 0, results: 0, ctr: 0, impressions: 0, name: cr.campaign_name ?? cid, days: 0 };
        }
        campaignSpend[cid].spend += num(cr.spend);
        campaignSpend[cid].results += (cr.actions ?? []).reduce((s, a) => s + num(a.value), 0);
        campaignSpend[cid].impressions += num(cr.impressions);
        campaignSpend[cid].ctr = num(cr.ctr); // last seen CTR
        campaignSpend[cid].days += 1;
      }
      for (const [asid, ar] of Object.entries(acct.by_adset)) {
        const aid2 = "adset_name" in ar ? (ar as { campaign_id?: string }).campaign_id ?? "" : "";
        if (!adsetSpend[asid]) {
          adsetSpend[asid] = { spend: 0, results: 0, ctr: 0, impressions: 0, name: (ar as { adset_name?: string }).adset_name ?? asid, campaignId: (ar as { campaign_id?: string }).campaign_id ?? "" };
        }
        adsetSpend[asid].spend += num(ar.spend);
        adsetSpend[asid].results += (ar.actions ?? []).reduce((s, a) => s + num(a.value), 0);
        adsetSpend[asid].impressions += num(ar.impressions);
        adsetSpend[asid].ctr = num(ar.ctr);
      }
    }
  }

  // Build nested campaign rows
  const campaignRows = Object.entries(campaignSpend)
    .map(([cid, c]) => {
      const children = Object.entries(adsetSpend)
        .filter(([, a]) => a.campaignId === cid)
        .map(([asid, a]) => ({
          id: asid,
          name: a.name,
          spend: a.spend,
          results: a.results,
          cpr: a.results > 0 && a.spend > 0 ? a.spend / a.results : null,
          ctr: a.ctr,
          impressions: a.impressions,
        }))
        .sort((a, b) => b.spend - a.spend);
      return {
        id: cid,
        name: c.name,
        spend: c.spend,
        results: c.results,
        cpr: c.results > 0 && c.spend > 0 ? c.spend / c.results : null,
        ctr: c.ctr,
        impressions: c.impressions,
        children,
      };
    })
    .sort((a, b) => b.spend - a.spend);

  // Budget pacing — use structure for daily_budget, spending from the period
  const pacingRows: {
    id: string;
    name: string;
    spend: number;
    budget: number;
    daysElapsed: number;
    totalDays: number;
  }[] = [];

  for (const [aid, acctStruct] of Object.entries(data.structure)) {
    if (!accountIds.includes(aid)) continue;
    for (const [cid, camp] of Object.entries(acctStruct.campaigns)) {
      const budgetCents = num(camp.daily_budget);
      if (budgetCents <= 0) continue;
      const dailyBudget = budgetCents / 100; // Meta returns in account currency * 100
      const cSpend = campaignSpend[cid]?.spend ?? 0;
      const daysSpent = campaignSpend[cid]?.days ?? 0;
      pacingRows.push({
        id: cid,
        name: camp.name,
        spend: cSpend,
        budget: dailyBudget * days,
        daysElapsed: daysSpent,
        totalDays: days,
      });
    }
  }
  const activePacingRows = pacingRows
    .filter((r) => r.spend > 0)
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 8);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-4 px-6 py-4 border-b border-[#27272a]">
        <Link
          href="/"
          className="text-[#71717a] hover:text-[#fafafa] transition-colors text-sm"
        >
          ← War Room
        </Link>
        <div className="h-4 w-px bg-[#27272a]" />
        <div>
          <div className="text-xs text-[#71717a] uppercase tracking-wider mb-0.5">
            {data.meta.accounts.length} account{data.meta.accounts.length !== 1 ? "s" : ""}
          </div>
          <h1 className="text-lg font-semibold">{data.meta.name}</h1>
        </div>
        <div className="ml-auto text-xs text-[#52525b]">
          {since} → {until}
        </div>
      </header>

      {/* Filter bar */}
      <Suspense>
        <FilterBar accounts={data.meta.accounts} />
      </Suspense>

      {/* KPI tiles */}
      <KPITileGrid metrics={metrics} />

      {/* Main content */}
      <main className="flex-1 p-6 grid gap-6 lg:grid-cols-3">
        {/* Spend chart */}
        <section className="lg:col-span-2 rounded-xl border border-[#27272a] bg-[#18181b] p-5">
          <div className="text-xs text-[#71717a] uppercase tracking-wide mb-4">
            Spend & Results — {range.toUpperCase()}
          </div>
          <SpendResultsChart data={chartData} />
        </section>

        {/* Budget pacing */}
        <section className="lg:col-span-1 rounded-xl border border-[#27272a] bg-[#18181b] p-5">
          <div className="text-xs text-[#71717a] uppercase tracking-wide mb-4">
            Budget Pacing
          </div>
          {activePacingRows.length > 0 ? (
            <BudgetPacingStrip campaigns={activePacingRows} />
          ) : (
            <div className="text-sm text-[#52525b]">No budgets to display</div>
          )}
        </section>

        {/* Breakdown table */}
        <section className="lg:col-span-3 rounded-xl border border-[#27272a] bg-[#18181b] p-5">
          <div className="text-xs text-[#71717a] uppercase tracking-wide mb-4">
            Campaign Breakdown
          </div>
          <BreakdownTable campaigns={campaignRows} />
        </section>
      </main>
    </div>
  );
}
