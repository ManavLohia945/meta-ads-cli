export interface AccountMeta {
  account_id: string;
  name: string;
}

export interface PortfolioMeta {
  slug: string;
  name: string;
  business_id: string;
  accounts: AccountMeta[];
  last_updated: string;
}

export interface ActionEntry {
  action_type: string;
  value: string;
}

export interface InsightRow {
  spend?: string;
  reach?: string;
  impressions?: string;
  inline_link_clicks?: string;
  frequency?: string;
  cpm?: string;
  cpc?: string;
  ctr?: string;
  actions?: ActionEntry[];
  cost_per_action_type?: ActionEntry[];
  purchase_roas?: ActionEntry[];
  video_30_sec_watched_actions?: ActionEntry[];
}

export interface CampaignInsightRow extends InsightRow {
  campaign_name?: string;
}

export interface AdsetInsightRow extends InsightRow {
  adset_name?: string;
  campaign_id?: string;
}

export interface AdInsightRow extends InsightRow {
  ad_name?: string;
  adset_id?: string;
  campaign_id?: string;
}

export interface AccountDayData {
  insights: InsightRow;
  by_campaign: Record<string, CampaignInsightRow>;
  by_adset: Record<string, AdsetInsightRow>;
  by_ad: Record<string, AdInsightRow>;
}

export interface DailyEntry {
  date: string;
  accounts: Record<string, AccountDayData>;
}

export interface CampaignStructure {
  id: string;
  name: string;
  status: string;
  objective: string;
  daily_budget?: string;
  lifetime_budget?: string;
  start_time?: string;
  stop_time?: string;
}

export interface AdsetStructure {
  id: string;
  name: string;
  status: string;
  campaign_id: string;
  daily_budget?: string;
}

export interface CreativeData {
  thumbnail_url?: string;
  effective_object_story_id?: string;
}

export interface AdStructure {
  id: string;
  name: string;
  status: string;
  adset_id: string;
  creative?: CreativeData;
}

export interface AccountStructure {
  campaigns: Record<string, CampaignStructure>;
  adsets: Record<string, AdsetStructure>;
  ads: Record<string, AdStructure>;
}

export interface ClientData {
  meta: PortfolioMeta;
  structure: Record<string, AccountStructure>;
  daily: DailyEntry[];
}

// Computed metrics (derived client-side from raw InsightRow)
export interface Metrics {
  spend: number;
  reach: number;
  impressions: number;
  clicks: number;
  results: number;
  cpr: number | null;
  roas: number | null;
  ctr: number;
  cpc: number | null;
  cpm: number;
  cplv: number | null;
  frequency: number;
}

export interface DeltaMetrics extends Metrics {
  spendDelta: number | null;
  resultsDelta: number | null;
  cprDelta: number | null;
  roasDelta: number | null;
}
