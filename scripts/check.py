"""
Connectivity check for all portfolios.
Fetches campaigns and yesterday's spend for every ad account.

Usage:
    py -3 scripts/check.py              # check all portfolios
    py -3 scripts/check.py akshay-paliwal  # check one portfolio by slug
"""

import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
from pathlib import Path
import yaml
import requests

ROOT = Path(__file__).parent.parent
ACCOUNTS_DIR = ROOT / "accounts"


def load_env(slug):
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


def get(url, params, timeout=10):
    try:
        r = requests.get(url, params=params, timeout=timeout)
        return r.json()
    except Exception as e:
        return {"error": {"message": str(e)}}


def check_account(base, token, acc):
    account_id = acc["account_id"]
    print(f"\n    Account : {acc['name']}")
    print(f"    ID      : act_{account_id}")

    if len(account_id) > 16:
        print(f"    WARNING : ID is {len(account_id)} digits — Meta IDs are usually ≤15. Double-check this.")

    # Campaigns
    data = get(f"{base}/act_{account_id}/campaigns", {
        "fields": "name,status,objective",
        "access_token": token,
        "limit": 10,
    })
    if "error" in data:
        print(f"    ERROR   : {data['error']['message']}")
        return

    campaigns = data.get("data", [])
    active = [c for c in campaigns if c.get("status") == "ACTIVE"]
    paused = [c for c in campaigns if c.get("status") == "PAUSED"]
    print(f"    Campaigns: {len(campaigns)} total  |  {len(active)} active  |  {len(paused)} paused")
    for c in campaigns[:5]:
        marker = "▶" if c.get("status") == "ACTIVE" else "‖"
        print(f"      {marker} {c.get('name', '?')}")
    if len(campaigns) > 5:
        print(f"      ... and {len(campaigns) - 5} more")

    # Yesterday's spend
    ins = get(f"{base}/act_{account_id}/insights", {
        "fields": "spend,impressions,clicks,reach",
        "date_preset": "yesterday",
        "access_token": token,
    })
    if "error" in ins:
        print(f"    Insights: ERROR — {ins['error']['message']}")
    else:
        rows = ins.get("data", [])
        if rows:
            d = rows[0]
            print(f"    Yesterday: spend=₹{d.get('spend','0')}  |  reach={d.get('reach','0')}  |  impressions={d.get('impressions','0')}  |  clicks={d.get('clicks','0')}")
        else:
            print(f"    Yesterday: no spend data")


def check_portfolio(portfolio, env):
    token = env.get("META_ACCESS_TOKEN", "")
    version = env.get("META_API_VERSION", "v21.0")
    base = f"https://graph.facebook.com/{version}"

    print(f"\n{'━' * 60}")
    print(f"  {portfolio['name']}  (slug: {portfolio['slug']})")
    print(f"  Business ID: {portfolio['business_id']}  |  API: {version}")
    print(f"{'━' * 60}")

    for acc in portfolio["ad_accounts"]:
        check_account(base, token, acc)


def main():
    yaml_file = ACCOUNTS_DIR / "accounts.yaml"
    config = yaml.safe_load(yaml_file.read_text(encoding="utf-8"))
    portfolios = config.get("portfolios", [])

    # Optional: filter to one slug from CLI arg
    filter_slug = sys.argv[1] if len(sys.argv) > 1 else None
    if filter_slug:
        portfolios = [p for p in portfolios if p["slug"] == filter_slug]
        if not portfolios:
            print(f"No portfolio found with slug: {filter_slug}")
            sys.exit(1)

    ok, skipped = 0, 0
    for portfolio in portfolios:
        slug = portfolio["slug"]
        env = load_env(slug)
        if not env:
            print(f"\nSKIPPED: {portfolio['name']} — missing accounts/{slug}.env")
            skipped += 1
            continue
        token = env.get("META_ACCESS_TOKEN", "")
        if not token or token == "PASTE_THIS_PORTFOLIO_ACCESS_TOKEN_HERE":
            print(f"\nSKIPPED: {portfolio['name']} — token not set in accounts/{slug}.env")
            skipped += 1
            continue
        check_portfolio(portfolio, env)
        ok += 1

    print(f"\n{'━' * 60}")
    print(f"  Done: {ok} checked, {skipped} skipped")
    print(f"{'━' * 60}\n")


if __name__ == "__main__":
    main()
