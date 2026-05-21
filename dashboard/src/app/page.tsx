import { loadAllPortfolios } from "@/lib/data-loader";
import { computeMetrics, rollupMetrics } from "@/lib/compute-metrics";
import { detectAnomalies } from "@/lib/anomaly-detection";
import { AgencyKPIBar } from "@/components/war-room/AgencyKPIBar";
import { AnomalyTicker } from "@/components/war-room/AnomalyTicker";
import { PortfolioCard } from "@/components/war-room/PortfolioCard";
import type { InsightRow, Metrics } from "@/lib/types";

function mergeRows(rows: InsightRow[]): InsightRow {
  const m: InsightRow = {};
  for (const r of rows) {
    if (!r.spend) continue;
    m.spend = String(parseFloat(m.spend ?? "0") + parseFloat(r.spend));
    m.impressions = String(
      parseFloat(m.impressions ?? "0") + parseFloat(r.impressions ?? "0")
    );
    m.inline_link_clicks = String(
      parseFloat(m.inline_link_clicks ?? "0") +
        parseFloat(r.inline_link_clicks ?? "0")
    );
    if (r.actions) {
      const acc = m.actions ?? [];
      for (const a of r.actions) {
        const ex = acc.find((x) => x.action_type === a.action_type);
        if (ex) ex.value = String(parseFloat(ex.value) + parseFloat(a.value));
        else acc.push({ ...a });
      }
      m.actions = acc;
    }
    if (r.purchase_roas?.length) m.purchase_roas = r.purchase_roas;
  }
  return m;
}

export default function WarRoom() {
  const portfolios = loadAllPortfolios();

  // Determine the common latest date across all portfolios
  const allDates = portfolios
    .flatMap((p) => p.data?.daily.map((d) => d.date) ?? [])
    .sort();
  const today = allDates.at(-1) ?? "";
  const sevenDaysAgo = allDates.filter((d) => d <= today).slice(-7)[0] ?? today;

  // Flatten account-level insights across all portfolios in the date window
  const allInsightRows: InsightRow[] = [];
  for (const p of portfolios) {
    if (!p.data) continue;
    for (const day of p.data.daily) {
      if (day.date < sevenDaysAgo || day.date > today) continue;
      for (const acct of Object.values(day.accounts)) {
        if (acct.insights?.spend) allInsightRows.push(acct.insights);
      }
    }
  }
  const kpis: Metrics = computeMetrics(mergeRows(allInsightRows));

  // Anomaly detection across all portfolios
  const anomalies = portfolios.flatMap((p) =>
    p.data
      ? detectAnomalies(p.slug, p.data.meta.name, p.data.daily, today)
      : []
  );

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-[#27272a]">
        <div>
          <div className="text-xs text-[#71717a] uppercase tracking-wider mb-0.5">
            Meta Ads
          </div>
          <h1 className="text-lg font-semibold">Command Center</h1>
        </div>
        <div className="text-xs text-[#52525b]">
          {today
            ? new Date(today + "T00:00:00").toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })
            : "No data"}
        </div>
      </header>

      <AgencyKPIBar metrics={kpis} />
      <AnomalyTicker anomalies={anomalies} />

      <main className="flex-1 p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {portfolios.map((p, i) => (
            <PortfolioCard
              key={p.slug}
              slug={p.slug}
              data={p.data!}
              error={p.error}
              index={i}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
