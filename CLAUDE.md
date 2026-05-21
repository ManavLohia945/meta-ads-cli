# Meta Ads CLI — Project Index

> **Do not make any changes until you are 95% confident in what you need to build.**

## What This Project Does

Digital marketing agency automation for Meta Ads — 9 business portfolios, some with 2-3 ad accounts each.
Built on `meta-ads-cli` (v0.1.0) + direct Meta Graph API calls for insights and reporting.

**Current capabilities:** Connection check across all portfolios
**Roadmap:** Unified dashboard (web) → Daily email reports → Campaign creation → AI creatives (GPT Image 2)

---

## Quick Reference

### meta-ads-cli commands (campaign operations only)
```powershell
.\run.ps1 <slug> create --config configs/my.yaml --dry-run
.\run.ps1 <slug> create --config configs/my.yaml
.\run.ps1 <slug> status CAMPAIGN_ID
.\run.ps1 <slug> pause CAMPAIGN_ID
.\run.ps1 <slug> activate CAMPAIGN_ID
```

### Scripts (data + validation)
```powershell
py -3 scripts/check.py               # test all 9 portfolios
py -3 scripts/check.py akshay-paliwal  # test one portfolio by slug
```

### Token Dashboard (local Claude Code usage)
```powershell
$env:PORT="9090"; py -3 token-dashboard/cli.py dashboard   # http://127.0.0.1:9090
py -3 token-dashboard/cli.py today
py -3 token-dashboard/cli.py stats
```

---

## Portfolio Registry

| Slug | Portfolio Name | Accounts | Type |
|------|---------------|----------|------|
| `akshay-paliwal` | Akshay Paliwal | 2 | internal |
| `smitha` | Balenso Ortho by Dr Gowtham Chowdary | 1 | internal |
| `satyam` | Finish Strong Project | 1 | internal |
| `anshul` | Anshul Dhamande | 1 | internal |
| `sourobh` | Fitness Master | 1 | internal |
| `sdp` | Science Driven Performance | 2 | internal |
| `shilpa` | Shilpa Chauhan | 1 | internal |
| `suvidhi` | Trainer Goes Online | 1 | internal |
| `ankita` | Trainer Goes Online | 1 | internal |

Full structure (business IDs, account IDs, page IDs): [accounts/accounts.yaml](accounts/accounts.yaml)
Credentials (per-portfolio): `accounts/<slug>.env` — gitignored, never commit

---

## Project Structure

```
meta-ads-cli/
├── .claude/
│   ├── settings.json              # MCPs disabled; context-window hook configured
│   └── skills/                    # Project-local skills (invoke with /<name>)
│       ├── session-handoff.md     # End-of-session handoff summary
│       ├── design-taste-frontend.md  # High-agency UI/UX engineering
│       ├── emil-design-eng.md     # Emil Kowalski animation + polish philosophy
│       └── impeccable.md          # Full frontend design system (craft/audit/polish)
├── accounts/
│   ├── accounts.yaml              # Portfolio + account registry (no secrets)
│   ├── _template.env              # Copy this to add a new portfolio
│   └── <slug>.env                 # Per-portfolio credentials (gitignored)
├── configs/
│   └── campaign.example.yaml      # Campaign creation template
├── scripts/
│   └── check.py                   # Connectivity + data validation
├── reports/                       # Daily report outputs (gitignored)
├── token-dashboard/               # Local Claude Code usage analytics
├── run.ps1                        # Portfolio-aware CLI wrapper
└── CLAUDE.md                      # This file
```

---

## Adding a New Portfolio

1. Add block to [accounts/accounts.yaml](accounts/accounts.yaml) (template in file comments)
2. `copy accounts\_template.env accounts\<slug>.env` then fill in VS Code
3. Run `py -3 scripts/check.py <slug>` to verify

---

## Skills & Sub-Agents

| Skill | Invoke | Purpose |
|-------|--------|---------|
| `session-handoff` | `/session-handoff` | Structured end-of-session summary before `/clear` |
| `design-taste-frontend` | `/design-taste-frontend` | High-agency UI/UX — enforces anti-slop rules, motion config, component architecture |
| `emil-design-eng` | `/emil-design-eng` | Emil Kowalski animation philosophy — easing, springs, transitions, polish |
| `impeccable` | `/impeccable` | Full frontend design suite — craft, critique, audit, polish, animate, colorize |

---

## Security Rules

- All `accounts/*.env` files are gitignored — never commit tokens
- Campaigns always created in `PAUSED` status — review before activating
- Always use `--dry-run` before `meta-ads create`
- Tokens expire in ~60 days — rotate proactively
- For non-expiring tokens: use System User tokens via Meta Business Manager
