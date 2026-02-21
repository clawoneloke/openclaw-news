# OpenClaw News Fetcher

Daily news fetcher for OpenClaw - fetches and summarizes news from multiple sources.

## Files

```
news/
├── fetch-news.js       # Main script - fetches and consolidates news
├── send-news.sh        # Notification sender - sends news via WhatsApp
├── news-config.json    # Configuration file
├── watchdog.js        # Health monitoring script
├── test-news.js       # Test suite
└── README.md          # This file
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
    "enabled": true,
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

## Systemd Setup (Recommended)

The news fetcher runs via systemd timer:

### Files
- `openclaw-news.service` - Fetches news and sends notification
- `openclaw-news.timer` - Runs daily at 7:20 AM (Mon-Sat)

### Setup

```bash
# Link service and timer
sudo ln -s ~/.openclaw/workspace/parkalotio-booker/systemd/openclaw-news.service /etc/systemd/system/
sudo ln -s ~/.openclaw/workspace/parkalotio-booker/systemd/openclaw-news.timer /etc/systemd/system/

# Reload and enable
sudo systemctl daemon-reload
sudo systemctl enable --now openclaw-news.timer

# Verify
sudo systemctl list-timers --all | grep openclaw-news
```

### Check Status

```bash
# View next run time
sudo systemctl status openclaw-news.timer

# Manual run
sudo systemctl start openclaw-news.service
```

## Notification System

The notification system uses a flag-based approach:
1. `fetch-news.js` creates `/tmp/news-notification.flag` after fetching
2. `send-news.sh` checks for the flag and sends the news via WhatsApp
3. The service runs both sequentially

## Testing

```bash
# Run tests
cd ~/.openclaw/workspace/news
node test-news.js

# Test fetch only
node fetch-news.js

# Test notification only
echo "1" > /tmp/news-notification.flag
./send-news.sh
```

## Logs

- News log: `~/.openclaw/logs/news.log`
- Error log: `~/.openclaw/logs/news.error.log`
- Output: `/tmp/latest-news.txt`

## GitHub

Repository: https://github.com/clawoneloke/openclaw-news
