# OpenClaw News Fetcher

Daily news fetcher for OpenClaw - fetches and summarizes news from multiple sources.

## Files

```
news/
├── fetch-news.js       # Main script - fetches and consolidates news
├── news-config.json    # Configuration file
├── test-news.js        # Test suite
├── watchdog.js         # Health monitoring script (standalone)
└── README.md           # This file
```

## Configuration (news-config.json)

```json
{
  "maxItems": 3,
  "cron": {
    "schedule": "15 7 * * 1,2,3,4,5,6",
    "timezone": "Pacific/Auckland"
  },
  "notifications": {
    "enabled": false,
    "channel": "whatsapp",
    "target": "+64220621342"
  },
  "sources": [
    { "name": "Bloomberg Markets", "url": "...", "maxHeadlines": 3, "enabled": true },
    { "name": "CNBC Business", "url": "...", "maxHeadlines": 3, "enabled": true },
    ...
  ],
  "filter": {
    "minLength": 40,
    "maxLength": 150,
    "excludePatterns": ["javascript", "cookie", ...],
    "keywords": []
  },
  "consolidation": {
    "maxItems": 3,
    "similarityThreshold": 0.5
  }
}
```

## Usage

```bash
cd ~/.openclaw/workspace/news
node fetch-news.js
```

Output is saved to `/tmp/latest-news.txt`.

## OpenClaw Cron Setup

The news fetcher runs via OpenClaw cron job (not systemd).

### Cron Job Configuration

The cron job is managed via OpenClaw's cron system:

```bash
# List cron jobs
openclaw cron list

# View job details
openclaw cron jobs <job-id>
```

### Manual Run

```bash
# Run directly
cd ~/.openclaw/workspace/news && node fetch-news.js

# Or via OpenClaw cron trigger
openclaw cron run "News Fetcher v2"
```

## Notification System

Notifications are delivered via OpenClaw cron job's `announce` delivery mode, not via a separate script.

The `fetch-news.js` output is saved to `/tmp/latest-news.txt` and the cron job's completion message (summary) is delivered to WhatsApp automatically.

### Deprecated: Flag-Based System

The `/tmp/news-notification.flag` file was part of an old notification approach that is no longer used. The current implementation relies on OpenClaw cron announce delivery.

## Testing

```bash
# Run all tests
cd ~/.openclaw/workspace/news
node test-news.js

# Test fetch only (requires network)
node fetch-news.js

# View output
cat /tmp/latest-news.txt
```

## Logs

- News output: `/tmp/latest-news.txt`
- Cron job history: via `openclaw cron runs <job-id>`
- Gateway logs: `tail -f ~/.openclaw/logs/*.log`

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  OpenClaw Cron Job (Schedule: 15 7 * * 1-6)               │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ fetch-news.js                                        │   │
│  │   1. Fetch from all sources (RSS + Brave API)        │   │
│  │   2. Clean and filter headlines                     │   │
│  │   3. Consolidate similar stories (Jaccard)          │   │
│  │   4. Score and rank                                 │   │
│  │   5. Output to /tmp/latest-news.txt                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                │
│                           ▼                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Cron Announce Delivery                              │   │
│  │   - Summary delivered to WhatsApp automatically     │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## GitHub

Repository: https://github.com/clawoneloke/openclaw-news
