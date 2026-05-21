"""
Daily cron: fetches yesterday's data for all portfolios and merges
into data/<slug>.json. Called by GitHub Actions at 6AM IST (00:30 UTC).

Usage:
    py -3 scripts/fetch_daily.py
    py -3 scripts/fetch_daily.py --date 2025-05-01
    py -3 scripts/fetch_daily.py --slug akshay-paliwal
"""

import argparse, io, json, sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

sys.path.insert(0, str(Path(__file__).parent))
from meta_api import (
    DATA_DIR, load_env, load_portfolios, token_ok,
    fetch_account, DEFAULT_API_VERSION,
)


def fetch_and_merge(portfolio, env, target_date):
    slug    = portfolio["slug"]
    name    = portfolio["name"]
    token   = env["META_ACCESS_TOKEN"]
    version = env.get("META_API_VERSION", DEFAULT_API_VERSION)
    base    = f"https://graph.facebook.com/{version}"

    print(f"\n{'━'*60}")
    print(f"  {name}  ({slug})  |  date: {target_date}")
    print(f"{'━'*60}")

    # Load existing JSON (or start fresh)
    out_file = DATA_DIR / f"{slug}.json"
    if out_file.exists():
        existing = json.loads(out_file.read_text(encoding="utf-8"))
    else:
        existing = {
            "meta": {
                "slug": slug,
                "name": name,
                "business_id": portfolio.get("business_id", ""),
                "accounts": [
                    {"account_id": a["account_id"], "name": a["name"]}
                    for a in portfolio["ad_accounts"]
                ],
                "last_updated": datetime.now(timezone.utc).isoformat(),
            },
            "structure": {},
            "daily": [],
        }

    # Fetch new data for target_date
    since = until = target_date
    daily_by_date = {}
    new_structure = {}

    for acc in portfolio["ad_accounts"]:
        try:
            acc_daily, acc_struct = fetch_account(base, token, acc, since, until)
            new_structure[acc["account_id"]] = acc_struct
            for d, data in acc_daily.items():
                if d not in daily_by_date:
                    daily_by_date[d] = {"date": d, "accounts": {}}
                daily_by_date[d]["accounts"][acc["account_id"]] = data
        except RuntimeError as e:
            print(f"  ERROR for {acc['name']}: {e}", flush=True)
            if "TOKEN_EXPIRED" in str(e):
                _write_error_sentinel(slug, str(e))
                return False

    if not daily_by_date:
        print(f"  WARNING: No data returned for {target_date}", flush=True)
        return False

    new_entry = daily_by_date.get(target_date)
    if not new_entry:
        print(f"  WARNING: No entry built for {target_date}", flush=True)
        return False

    # Refresh structure block with today's current campaign/ad state
    existing["structure"] = new_structure

    # Merge: replace existing entry for this date, or append
    daily_list = existing.get("daily", [])
    existing_dates = [e["date"] for e in daily_list]
    if target_date in existing_dates:
        idx = existing_dates.index(target_date)
        daily_list[idx] = new_entry
        print(f"  replaced entry for {target_date}", flush=True)
    else:
        daily_list.append(new_entry)
        print(f"  appended entry for {target_date}", flush=True)

    existing["daily"] = sorted(daily_list, key=lambda x: x["date"])
    existing["meta"]["last_updated"] = datetime.now(timezone.utc).isoformat()

    # Atomic write
    tmp = DATA_DIR / f"{slug}.json.tmp"
    tmp.write_text(json.dumps(existing, indent=2, ensure_ascii=False), encoding="utf-8")
    tmp.replace(out_file)
    print(f"  ✓ Updated {slug}.json", flush=True)
    return True


def _write_error_sentinel(slug, message):
    sentinel = DATA_DIR / f"{slug}.error.json"
    sentinel.write_text(
        json.dumps({
            "error": "token_expired",
            "slug": slug,
            "date": datetime.now(timezone.utc).isoformat(),
            "message": message,
        }, indent=2),
        encoding="utf-8",
    )


def main():
    parser = argparse.ArgumentParser(description="Daily Meta Ads fetch")
    parser.add_argument(
        "--date",
        help="Date to fetch YYYY-MM-DD (default: yesterday)",
    )
    parser.add_argument("--slug", help="Only this portfolio slug")
    args = parser.parse_args()

    target_date = args.date or (date.today() - timedelta(days=1)).isoformat()
    print(f"Fetching data for: {target_date}", flush=True)

    portfolios = load_portfolios(args.slug)

    ok = skipped = errors = 0
    for portfolio in portfolios:
        slug = portfolio["slug"]
        env  = load_env(slug)
        if not env or not token_ok(env):
            reason = "missing .env file" if not env else "token not set"
            print(f"\nSKIPPED: {portfolio['name']} — {reason}")
            skipped += 1
            continue
        if fetch_and_merge(portfolio, env, target_date):
            ok += 1
        else:
            errors += 1

    print(f"\n{'━'*60}")
    print(f"  Done: {ok} updated, {skipped} skipped, {errors} errors")
    print(f"{'━'*60}\n")


if __name__ == "__main__":
    main()
