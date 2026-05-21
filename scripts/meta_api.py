"""
Shared Meta Graph API helpers.
Imported by fetch_history.py and fetch_daily.py.

JSON schema produced per portfolio:
{
  "meta":      { slug, name, business_id, accounts[], last_updated },
  "structure": { "<account_id>": { campaigns:{id:{}}, adsets:{id:{}}, ads:{id:{}} } },
  "daily": [
    {
      "date": "YYYY-MM-DD",
      "accounts": {
        "<account_id>": {
          "insights":    { spend, reach, ... },          -- account-level totals
          "by_campaign": { "<id>": { campaign_name, spend, reach, ... } },
          "by_adset":    { "<id>": { adset_name, campaign_id, spend, ... } },
          "by_ad":       { "<id>": { ad_name, adset_id, campaign_id, spend, ... } }
        }
      }
    }
  ]
}

Using flat dicts (not nested) so historical campaigns that were deleted still appear,
and the join never fails. Campaign/adset/ad names come from the insight rows directly.
Structure block holds current-state data: status, budget, creative thumbnails.
"""

import json, os, time
from datetime import date, timedelta
from pathlib import Path

import requests
import yaml

ROOT         = Path(__file__).parent.parent
ACCOUNTS_DIR = ROOT / "accounts"
DATA_DIR     = ROOT / "data"
DATA_DIR.mkdir(exist_ok=True)

DEFAULT_API_VERSION = "v21.0"

INSIGHTS_FIELDS = (
    "spend,reach,impressions,inline_link_clicks,"
    "frequency,cpm,cpc,ctr,"
    "actions,cost_per_action_type,"
    "purchase_roas,video_30_sec_watched_actions"
)

# Entity ID + name fields to append per insight level so _group can key by entity.
# Meta does NOT auto-include these even when level=campaign/adset/ad.
_LEVEL_FIELDS = {
    "account":  "",
    "campaign": ",campaign_id,campaign_name",
    "adset":    ",adset_id,adset_name,campaign_id",
    "ad":       ",ad_id,ad_name,adset_id,campaign_id",
}

# Base insight metrics kept for every level
_METRICS = frozenset([
    "spend", "reach", "impressions", "inline_link_clicks",
    "frequency", "cpm", "cpc", "ctr",
    "actions", "cost_per_action_type",
    "purchase_roas", "video_30_sec_watched_actions",
])

# Per-level: metrics + entity metadata (names / parent IDs for hierarchy).
# Entity IDs are requested explicitly via _LEVEL_FIELDS (Meta does not auto-include them).
ACCT_KEEP     = _METRICS
CAMP_KEEP     = _METRICS | {"campaign_name"}
ADSET_KEEP    = _METRICS | {"adset_name", "campaign_id"}
AD_KEEP       = _METRICS | {"ad_name", "adset_id", "campaign_id"}


# ── credentials ──────────────────────────────────────────────────────────────

def load_env(slug):
    """
    Returns credentials dict. Checks env vars first (GitHub Actions),
    then falls back to accounts/<slug>.env.
    """
    env_key = slug.upper().replace("-", "_") + "_TOKEN"
    token = os.environ.get(env_key)
    if token:
        return {
            "META_ACCESS_TOKEN": token,
            "META_API_VERSION": os.environ.get("META_API_VERSION", DEFAULT_API_VERSION),
        }

    env_file = ACCOUNTS_DIR / f"{slug}.env"
    if not env_file.exists():
        return None
    env = {}
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, val = line.partition("=")
            env[key.strip()] = val.strip()
    return env


def load_portfolios(slug_filter=None):
    yaml_file = ACCOUNTS_DIR / "accounts.yaml"
    config = yaml.safe_load(yaml_file.read_text(encoding="utf-8"))
    portfolios = config.get("portfolios", [])
    if slug_filter:
        portfolios = [p for p in portfolios if p["slug"] == slug_filter]
    return portfolios


def token_ok(env):
    if not env:
        return False
    t = env.get("META_ACCESS_TOKEN", "")
    return bool(t) and t != "PASTE_THIS_PORTFOLIO_ACCESS_TOKEN_HERE"


# ── HTTP ─────────────────────────────────────────────────────────────────────

def _api_get(url, params, timeout=90):
    """Single GET. Returns parsed JSON. Sleeps if app usage > 75%."""
    try:
        r = requests.get(url, params=params, timeout=timeout)
        usage_str = r.headers.get("x-app-usage") or r.headers.get("X-App-Usage", "")
        if usage_str:
            try:
                usage = json.loads(usage_str)
                pct = max(
                    usage.get("call_count", 0),
                    usage.get("total_time", 0),
                    usage.get("total_cputime", 0),
                )
                if pct > 75:
                    print(f"    [rate-limit] App usage {pct}% — sleeping 60s", flush=True)
                    time.sleep(60)
            except Exception:
                pass
        return r.json()
    except Exception as e:
        return {"error": {"message": str(e)}}


def paginate(url, params, max_retries=5):
    """Yield all items across cursor-paginated Meta API responses."""
    cur_url, cur_params = url, params
    while True:
        backoff = 30
        data = None
        for attempt in range(max_retries):
            data = _api_get(cur_url, cur_params)
            if "error" in data:
                code = data["error"].get("code", 0)
                msg  = data["error"].get("message", "")
                if code in (0, 1, 2, 17):
                    label = "rate-limit" if code == 17 else "network error"
                    print(
                        f"    [{label}] code {code} — sleeping {backoff}s "
                        f"(attempt {attempt+1}/{max_retries}): {msg[:80]}",
                        flush=True,
                    )
                    time.sleep(backoff)
                    backoff = min(backoff * 2, 240)
                    continue
                elif code == 190:
                    raise RuntimeError(f"TOKEN_EXPIRED — {msg}")
                else:
                    raise RuntimeError(f"API error {code}: {msg}")
            break
        else:
            raise RuntimeError("Max retries exceeded on rate-limit")

        yield from data.get("data", [])

        next_url = data.get("paging", {}).get("next")
        if next_url:
            cur_url, cur_params = next_url, {}  # all params baked into next_url
        else:
            break


# ── API fetchers ─────────────────────────────────────────────────────────────

# Filter applied to campaign/adset/ad level insights and structure lists.
# Account-level insights are intentionally unfiltered so KPI totals are complete.
_ACTIVE_FILTER = json.dumps([
    {"field": "campaign.effective_status", "operator": "IN", "value": ["ACTIVE"]}
])
_ACTIVE_STATUS = json.dumps(["ACTIVE"])


def get_insights(base, token, account_id, level, since, until):
    """Fetch insights at account/campaign/adset/ad level for a date range.
    Each row includes date_start + the entity id/name at that level.
    No status filtering on insights — the API only returns rows where spend
    occurred, so paused/deleted historical campaigns still appear correctly."""
    params = {
        "fields": INSIGHTS_FIELDS + _LEVEL_FIELDS[level],
        "level": level,
        "time_range": json.dumps({"since": since, "until": until}),
        "time_increment": "1",
        "access_token": token,
        "limit": 500,
    }
    return list(paginate(f"{base}/act_{account_id}/insights", params))


def get_campaigns(base, token, account_id):
    """Returns only ACTIVE campaigns (structure block)."""
    return list(paginate(
        f"{base}/act_{account_id}/campaigns",
        {
            "fields": "id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time",
            "effective_status": _ACTIVE_STATUS,
            "access_token": token,
            "limit": 100,
        },
    ))


def get_adsets(base, token, account_id):
    """Returns only ACTIVE adsets (structure block)."""
    return list(paginate(
        f"{base}/act_{account_id}/adsets",
        {
            "fields": "id,name,status,campaign_id,daily_budget",
            "effective_status": _ACTIVE_STATUS,
            "access_token": token,
            "limit": 500,
        },
    ))


def get_ads(base, token, account_id):
    """Returns only ACTIVE ads (structure block)."""
    return list(paginate(
        f"{base}/act_{account_id}/ads",
        {
            "fields": "id,name,status,adset_id,creative{thumbnail_url,effective_object_story_id}",
            "effective_status": _ACTIVE_STATUS,
            "access_token": token,
            "limit": 500,
        },
    ))


# ── data assembly ─────────────────────────────────────────────────────────────

def date_range(since, until):
    cur = date.fromisoformat(since)
    end = date.fromisoformat(until)
    while cur <= end:
        yield cur.isoformat()
        cur += timedelta(days=1)


def _keep(row, fields):
    """Return a dict with only the keys in `fields`."""
    if not row:
        return {}
    return {k: v for k, v in row.items() if k in fields}


def build_account_data(
    since, until,
    acct_ins_rows, camp_ins_rows, adset_ins_rows, ad_ins_rows,
    campaigns, adsets, ads,
):
    """
    Assemble per-date flat insight dicts + current structure for one account.

    Returns (daily_dict, structure_dict):
      daily_dict  — { date_str: { insights, by_campaign, by_adset, by_ad } }
      structure_dict — { campaigns:{id:obj}, adsets:{id:obj}, ads:{id:obj} }

    Insight rows drive campaign/adset/ad identity so deleted entities still appear.
    Structure block carries current status, budget, and creative thumbnail URLs.
    """
    def _group(rows, id_field):
        """{ date -> { entity_id -> row } }"""
        out = {}
        for row in rows:
            d   = row.get("date_start")
            eid = row.get(id_field)
            if d and eid:
                out.setdefault(d, {})[eid] = row
        return out

    acct_by_date  = {r["date_start"]: r for r in acct_ins_rows  if r.get("date_start")}
    camp_by_date  = _group(camp_ins_rows,  "campaign_id")
    adset_by_date = _group(adset_ins_rows, "adset_id")
    ad_by_date    = _group(ad_ins_rows,    "ad_id")

    daily = {}
    for d in date_range(since, until):
        daily[d] = {
            "insights":    _keep(acct_by_date.get(d), ACCT_KEEP),
            "by_campaign": {cid: _keep(row, CAMP_KEEP)  for cid, row in camp_by_date.get(d, {}).items()},
            "by_adset":    {aid: _keep(row, ADSET_KEEP) for aid, row in adset_by_date.get(d, {}).items()},
            "by_ad":       {adid: _keep(row, AD_KEEP)   for adid, row in ad_by_date.get(d, {}).items()},
        }

    structure = {
        "campaigns": {c["id"]: c for c in campaigns},
        "adsets":    {a["id"]: a for a in adsets},
        "ads":       {a["id"]: a for a in ads},
    }

    return daily, structure


def fetch_account(base, token, acc, since, until, verbose=True):
    """
    Fetch all data for one account over [since, until].
    Returns (daily_dict, structure_dict).
    """
    account_id = acc["account_id"]
    if verbose:
        print(f"    account: {acc['name']}  (act_{account_id})", flush=True)
    if len(account_id) > 16:
        print(f"      WARNING: ID is {len(account_id)} digits (unusual for Meta)", flush=True)

    def step(label, fn, fatal=True):
        if verbose:
            print(f"      → {label}", end="  ", flush=True)
        try:
            rows = fn()
        except RuntimeError as e:
            if fatal:
                raise
            if verbose:
                print(f"WARNING: {e}", flush=True)
            return []
        if verbose:
            print(f"({len(rows)})", flush=True)
        return rows

    campaigns = step("campaigns",         lambda: get_campaigns(base, token, account_id))
    adsets    = step("adsets",            lambda: get_adsets(base, token, account_id))
    ads       = step("ads + creatives",   lambda: get_ads(base, token, account_id))
    acct_ins  = step("account insights",  lambda: get_insights(base, token, account_id, "account",  since, until))
    camp_ins  = step("campaign insights", lambda: get_insights(base, token, account_id, "campaign", since, until))
    adset_ins = step("adset insights",    lambda: get_insights(base, token, account_id, "adset",    since, until))
    ad_ins    = step("ad insights",       lambda: get_insights(base, token, account_id, "ad",       since, until), fatal=False)

    return build_account_data(
        since, until,
        acct_ins, camp_ins, adset_ins, ad_ins,
        campaigns, adsets, ads,
    )
