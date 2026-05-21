import type { InsightRow, Metrics, DailyEntry, AccountDayData } from "./types";

function num(v: string | undefined): number {
  return v ? parseFloat(v) : 0;
}

function actionValue(
  list: { action_type: string; value: string }[] | undefined,
  type: string
): number {
  return num(list?.find((a) => a.action_type === type)?.value);
}

// Objective → result action_type mapping (extend as needed)
const OBJECTIVE_ACTION: Record<string, string> = {
  OUTCOME_LEADS: "lead",
  OUTCOME_SALES: "purchase",
  OUTCOME_ENGAGEMENT: "post_engagement",
  OUTCOME_TRAFFIC: "link_click",
  OUTCOME_AWARENESS: "reach",
  LEAD_GENERATION: "lead",
  CONVERSIONS: "purchase",
  LINK_CLICKS: "link_click",
  MESSAGES: "onsite_conversion.messaging_conversation_started_7d",
};

export function computeMetrics(
  row: InsightRow,
  objective?: string
): Metrics {
  const spend = num(row.spend);
  const reach = num(row.reach);
  const impressions = num(row.impressions);
  const clicks = num(row.inline_link_clicks);
  const frequency = num(row.frequency);
  const cpm = num(row.cpm);
  const cpc = num(row.cpc);
  const ctr = num(row.ctr);

  const roas =
    row.purchase_roas?.length
      ? parseFloat(row.purchase_roas[0].value)
      : null;

  const videoViews = row.video_30_sec_watched_actions?.reduce(
    (sum, a) => sum + num(a.value),
    0
  ) ?? 0;

  const actionKey = objective ? OBJECTIVE_ACTION[objective] : undefined;
  const results = actionKey
    ? actionValue(row.actions, actionKey)
    : (row.actions?.reduce((sum, a) => sum + num(a.value), 0) ?? 0);

  return {
    spend,
    reach,
    impressions,
    clicks,
    results,
    cpr: results > 0 && spend > 0 ? spend / results : null,
    roas,
    ctr,
    cpc: clicks > 0 && spend > 0 ? spend / clicks : cpc > 0 ? cpc : null,
    cpm,
    cplv: videoViews > 0 && spend > 0 ? spend / videoViews : null,
    frequency,
  };
}

// Sum metrics across multiple InsightRows (e.g. multiple accounts in one day)
export function sumInsightRows(rows: InsightRow[]): InsightRow {
  const merged: InsightRow = {};
  for (const row of rows) {
    if (!row.spend) continue;
    merged.spend = String(num(merged.spend) + num(row.spend));
    merged.reach = String(num(merged.reach) + num(row.reach));
    merged.impressions = String(num(merged.impressions) + num(row.impressions));
    merged.inline_link_clicks = String(
      num(merged.inline_link_clicks) + num(row.inline_link_clicks)
    );
    // Actions: merge by action_type
    if (row.actions) {
      const acc = merged.actions ?? [];
      for (const a of row.actions) {
        const existing = acc.find((x) => x.action_type === a.action_type);
        if (existing) {
          existing.value = String(num(existing.value) + num(a.value));
        } else {
          acc.push({ ...a });
        }
      }
      merged.actions = acc;
    }
  }
  return merged;
}

// Roll up all account-level insight rows for a date range
export function rollupMetrics(
  daily: DailyEntry[],
  since: string,
  until: string,
  accountIds?: string[]
): Metrics {
  const rows: InsightRow[] = [];
  for (const day of daily) {
    if (day.date < since || day.date > until) continue;
    for (const [aid, acct] of Object.entries(day.accounts)) {
      if (accountIds && !accountIds.includes(aid)) continue;
      if (acct.insights?.spend) rows.push(acct.insights);
    }
  }
  return computeMetrics(sumInsightRows(rows));
}

// Get an AccountDayData for a single date, merging multiple accounts if needed
export function getDayData(
  daily: DailyEntry[],
  date: string,
  accountIds?: string[]
): AccountDayData {
  const day = daily.find((d) => d.date === date);
  if (!day) return { insights: {}, by_campaign: {}, by_adset: {}, by_ad: {} };

  const accounts = accountIds
    ? Object.entries(day.accounts).filter(([id]) => accountIds.includes(id))
    : Object.entries(day.accounts);

  const merged: AccountDayData = {
    insights: sumInsightRows(accounts.map(([, a]) => a.insights)),
    by_campaign: Object.assign({}, ...accounts.map(([, a]) => a.by_campaign)),
    by_adset: Object.assign({}, ...accounts.map(([, a]) => a.by_adset)),
    by_ad: Object.assign({}, ...accounts.map(([, a]) => a.by_ad)),
  };
  return merged;
}
