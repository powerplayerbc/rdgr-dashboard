# RDGR Command Center Dashboard

**Domain**: rdgr.bradfordcarlton.com
**Repo**: powerplayerbc/rdgr-dashboard
**Deploy folder**: ~/Documents/rdgr-dashboard-deploy/
**Coolify App UUID**: w08oo88cs808wwssowsscc88

## Pages (14 total)

| Nav Tab | Source File | Deploy Route |
|---------|------------|-------------|
| Dashboard | index.html | / and /rdgr |
| Chat | chat.html | /chat |
| Org Map | org-chart.html | /org-chart |
| Workflows | our-workflows.html | /our-workflows |
| Social | social-dashboard.html | /social-dashboard |
| CRM | crm.html | /crm |
| Offers | offer-studio.html | /offer-studio |
| DEFT | deft.html | /deft |
| BRAIN | brain.html | /brain |
| Settings | settings-directory.html | /settings |
| DEFT Settings | deft-settings.html | /deft-settings |
| Voice Settings | settings.html | /email-voice-settings |
| Social Voice | social-voice-settings.html | /social-voice-settings |
| Scraper | scraper-settings.html | /scraper-settings |

## Deploy

See `DEPLOY_MAP.md` in the repo root for source-to-deploy path mapping. Key gotcha: `settings.html` deploys as `email-voice-settings.html`, NOT `settings/index.html`.

## Auth

All pages use localStorage-based persistent auth (key: `rdgr-session`). Password: `Advance1!`. Profile stored in `rdgr-active-profile`. No `?auth=rdgr` query params needed.
