"""
One-time backfill: fetches Meta Ads data for all portfolios and writes
per-client JSON to data/<slug>.json.

Usage:
    py -3 scripts/fetch_history.py
    py -3 scripts/fetch_history.py --start 2025-04-01 --end 2025-05-01
    py -3 scripts/fetch_history.py --slug akshay-paliwal
    py -3 scripts/fetch_history.py --slug akshay-paliwal --start 2025-04-01 --end 2025-04-15
"""

import argparse, io, json, sys
from datetime import datetime, timezone
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# meta_api.py is in the same directory
sys.path.insert(0, str(Path(__file__).parent))
from meta_api import (
    DATA_DIR, load_env, load_portfolios, token_ok,
    fetch_account, DEFAULT_API_VERSION,
)

DEFAULT_START = "2026-04-01"
DEFAULT_END   = "2026-05-01"


def fetch_and_write(portfolio, env, since, until):
    slug  = portfolio["slug"]
    name  = portfolio["name"]
    token = env["META_ACCESS_TOKEN"]
    version = env.get("META_API_VERSION", DEFAULT_API_VERSION)
    base  = f"https://graph.facebook.com/{version}"

    print(f"\n{'━'*60}")
    print(f"  {name}  ({slug})")
    print(f"  {since} → {until}  |  API: {version}")
    print(f"{'━'*60}")

    daily_by_date = {}   # { date: { "date": d, "accounts": { acc_id: {insights, by_*} } } }
    structure     = {}   # { acc_id: { campaigns:{}, adsets:{}, ads:{} } }

    for acc in portfolio["ad_accounts"]:
        try:
            acc_daily, acc_struct = fetch_account(base, token, acc, since, until)
            structure[acc["account_id"]] = acc_struct
            for d, data in acc_daily.items():
                if d not in daily_by_date:
                    daily_by_date[d] = {"date": d, "accounts": {}}
                daily_by_date[d]["accounts"][acc["account_id"]] = data
        except RuntimeError as e:
            print(f"\n  ERROR for {acc['name']}: {e}", flush=True)
            if "TOKEN_EXPIRED" in str(e):
                _write_error_sentinel(slug, str(e))
                return False

    if not daily_by_date:
        print(f"  WARNING: No data fetched for {slug}", flush=True)
        return False

    output = {
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
        "structure": structure,
        "daily": [daily_by_date[d] for d in sorted(daily_by_date)],
    }

    _atomic_write(slug, output)
    print(f"\n  ✓ Written {slug}.json  ({len(output['daily'])} days)", flush=True)
    return True


def _atomic_write(slug, data):
    out = DATA_DIR / f"{slug}.json"
    tmp = DATA_DIR / f"{slug}.json.tmp"
    tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    tmp.replace(out)


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
    parser = argparse.ArgumentParser(description="Fetch Meta Ads history")
    parser.add_argument("--start", default=DEFAULT_START,
                        help=f"Start date YYYY-MM-DD (default: {DEFAULT_START})")
    parser.add_argument("--end",   default=DEFAULT_END,
                        help=f"End date YYYY-MM-DD (default: {DEFAULT_END})")
    parser.add_argument("--slug",  help="Only fetch this portfolio slug")
    args = parser.parse_args()

    portfolios = load_portfolios(args.slug)
    if args.slug and not portfolios:
        print(f"No portfolio found with slug: {args.slug}")
        sys.exit(1)

    ok = skipped = errors = 0
    for portfolio in portfolios:
        slug = portfolio["slug"]
        env  = load_env(slug)
        if not env or not token_ok(env):
            reason = "missing .env file" if not env else "token not set"
            print(f"\nSKIPPED: {portfolio['name']} — {reason}")
            skipped += 1
            continue
        if fetch_and_write(portfolio, env, args.start, args.end):
            ok += 1
        else:
            errors += 1

    print(f"\n{'━'*60}")
    print(f"  Done: {ok} written, {skipped} skipped, {errors} errors")
    print(f"{'━'*60}\n")


if __name__ == "__main__":
    main()
