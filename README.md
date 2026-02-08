# OpenClaw News Fetcher

Daily news fetcher for OpenClaw - fetches and summarizes news from multiple sources.

## Files

```
news/
├── fetch-news.js       # Main script
├── news-config.json    # Configuration file
└── README.md           # This file
```

## Configuration (news-config.json)

```json
{
  "maxItems": 3,              // Total news items to return
  "cron": {
    "schedule": "15 7 * * 2,3,4,5,6",  // Tue-Sat at 7:15am NZT
    "timezone": "Pacific/Auckland"
  },
  "sources": [
    { "name": "Yahoo Finance", "url": "...", "maxHeadlines": 3 },
    { "name": "MarketWatch", "url": "...", "maxHeadlines": 3 },
    { "name": "CNBC", "url": "...", "maxHeadlines": 3 }
  ],
  "filter": {
    "minLength": 40,
    "maxLength": 150,
    "excludePatterns": ["javascript", "cookie", "advertisement", ...],
    "keywords": []
  }
}
```

## Usage

```bash
cd ~/.openclaw/workspace/news
node fetch-news.js
```

## Output

News is saved to `/tmp/latest-news.txt` and sent via WhatsApp.

## GitHub

Repository: https://github.com/clawoneloke/openclaw-news
