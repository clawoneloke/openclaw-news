# OpenClaw News Fetcher

Daily news fetcher for OpenClaw - fetches, consolidates, and summarizes news from multiple sources.

## Files

```
news/
├── fetch-news.js       # Main script - fetches, consolidates, outputs news
├── news-config.json    # Configuration file
├── watchdog.js         # Health monitoring script
├── tests/
│   ├── unit.test.js       # Unit tests
│   ├── integration.test.js # Integration tests
│   └── run-tests.js       # Test runner
└── README.md           # This file
```

## Quick Start

```bash
cd ~/.openclaw/workspace/news
node fetch-news.js
```

Output saved to `/tmp/latest-news.txt` (Markdown format).

## Features

- **Multi-source fetching**: RSS feeds + Brave Search API
- **Parallel fetching**: All sources fetched concurrently
- **Retry logic**: Exponential backoff on failures (2 retries default)
- **Smart consolidation**: Jaccard similarity algorithm deduplicates stories
- **Multi-format output**: JSON, Markdown, HTML, plain text
- **Health monitoring**: Watchdog script for alerting
- **Configurable filtering**: Length, patterns, keywords

## Configuration (news-config.json)

```json
{
  "maxItems": 3,
  "braveApiKey": "${BRAVE_API_KEY}",
  "output": {
    "formats": ["markdown", "json", "html", "plain"]
  },
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
    { "name": "CNBC Business", "url": "...", "maxHeadlines": 3, "enabled": true }
  ],
  "filter": {
    "minLength": 40,
    "maxLength": 150,
    "excludePatterns": ["javascript", "cookie", "advertisement"],
    "keywords": []
  },
  "consolidation": {
    "maxItems": 3,
    "similarityThreshold": 0.5,
    "scoring": {
      "sourceCountWeight": 2.0,
      "recencyWeight": 1.0
    }
  }
}
```

### Output Formats

| Format | Default Path | Description |
|--------|--------------|-------------|
| markdown | `/tmp/latest-news.txt` | WhatsApp-friendly Markdown |
| json | `/tmp/news-summary.json` | Full metadata + raw results |
| html | `/tmp/news-summary.html` | Styled HTML page |
| plain | `/tmp/news-summary.txt` | Plain text |

### Source Types

- **RSS**: Standard RSS/Atom feeds
- **API**: Brave Search API (`type: "api"`, `api: "brave"`)

## Cron Job Setup

The news fetcher runs via OpenClaw cron job.

```bash
# List cron jobs
openclaw cron list

# Run manually
cd ~/.openclaw/workspace/news && node fetch-news.js
```

## Watchdog Health Monitoring

Run separately to monitor fetcher health:

```bash
node watchdog.js
# Exit codes: 0=healthy, 1=unhealthy, 2=error
```

Alerts via WhatsApp if no successful run in 30+ hours.

## Testing

```bash
# Run all tests
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  OpenClaw Cron Job (Schedule: 15 7 * * 1-6)              │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ fetch-news.js                                        │   │
│  │   1. Load config (news-config.json)                   │   │
│  │   2. Fetch from all sources IN PARALLEL              │   │
│  │   3. Retry failed sources (2 attempts, backoff)       │   │
│  │   4. Filter headlines (length, patterns, keywords)   │   │
│  │   5. Consolidate (Jaccard similarity clustering)      │   │
│  │   6. Score & rank (source count + recency)            │   │
│  │   7. Output to multiple formats                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                │
│                           ▼                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Output Files                                         │   │
│  │   - /tmp/latest-news.txt (Markdown)                 │   │
│  │   - /tmp/news-summary.json (JSON)                   │   │
│  │   - /tmp/news-summary.html (HTML)                   │   │
│  │   - /tmp/news-summary.txt (Plain)                   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## GitHub

Repository: https://github.com/clawoneloke/openclaw-news
