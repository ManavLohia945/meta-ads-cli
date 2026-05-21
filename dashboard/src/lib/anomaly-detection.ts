import type { DailyEntry } from "./types";
import { computeMetrics } from "./compute-metrics";

export interface Anomaly {
  slug: string;
  portfolioName: string;
  metric: string;
  today: number;
  avg7d: number;
  pctChange: number;
  direction: "up" | "down";
}

const THRESHOLD = 0.3; // 30% deviation

export function detectAnomalies(
  slug: string,
  portfolioName: string,
  daily: DailyEntry[],
  today: string
): Anomaly[] {
  const sorted = [...daily].sort((a, b) => a.date.localeCompare(b.date));
  const todayIdx = sorted.findIndex((d) => d.date === today);
  if (todayIdx < 1) return [];

  // 7-day window ending the day before today
  const window = sorted.slice(Math.max(0, todayIdx - 7), todayIdx);
  if (window.length === 0) return [];

  function daySpend(day: DailyEntry): number {
    return Object.values(day.accounts).reduce(
      (s, a) => s + parseFloat(a.insights?.spend ?? "0"),
      0
    );
  }

  function dayCPR(day: DailyEntry): number | null {
    const rows = Object.values(day.accounts).map((a) => a.insights);
    const m = computeMetrics(rows.reduce((acc, r) => {
      if (!r.spend) return acc;
      acc.spend = String(parseFloat(acc.spend ?? "0") + parseFloat(r.spend ?? "0"));
      if (r.actions) {
        const existing = acc.actions ?? [];
        for (const a of r.actions) {
          const ex = existing.find((x) => x.action_type === a.action_type);
          if (ex) ex.value = String(parseFloat(ex.value) + parseFloat(a.value));
          else existing.push({ ...a });
        }
        acc.actions = existing;
      }
      return acc;
    }, {} as (typeof rows)[0]));
    return m.cpr;
  }

  const todayDay = sorted[todayIdx];
  const todaySpend = daySpend(todayDay);
  const avgSpend = window.reduce((s, d) => s + daySpend(d), 0) / window.length;

  const anomalies: Anomaly[] = [];

  if (avgSpend > 0) {
    const pct = (todaySpend - avgSpend) / avgSpend;
    if (Math.abs(pct) > THRESHOLD) {
      anomalies.push({
        slug,
        portfolioName,
        metric: "Spend",
        today: todaySpend,
        avg7d: avgSpend,
        pctChange: pct,
        direction: pct > 0 ? "up" : "down",
      });
    }
  }

  // CPR anomaly
  const todayCPR = dayCPR(todayDay);
  const windowCPRs = window.map(dayCPR).filter((x): x is number => x !== null);
  if (todayCPR !== null && windowCPRs.length > 0) {
    const avgCPR = windowCPRs.reduce((s, v) => s + v, 0) / windowCPRs.length;
    if (avgCPR > 0) {
      const pct = (todayCPR - avgCPR) / avgCPR;
      if (Math.abs(pct) > THRESHOLD) {
        anomalies.push({
          slug,
          portfolioName,
          metric: "CPR",
          today: todayCPR,
          avg7d: avgCPR,
          pctChange: pct,
          direction: pct > 0 ? "up" : "down",
        });
      }
    }
  }

  return anomalies;
}
