# OpenClaw News Quick Start

Get the news fetcher running in 2 minutes.

## Setup

```bash
cd ~/.openclaw/workspace/news

# Install dependencies (optional - uses built-in Node modules)
npm install
```

## Configuration

Edit `news-config.json` to customize:

```json
{
  "maxItems": 15,
  "cron": {
    "schedule": "15 7 * * 1,2,3,4,5,6",
    "timezone": "Pacific/Auckland"
  },
  "sources": [
    { "name": "Bloomberg Markets", "enabled": true },
    { "name": "CNBC Business", "enabled": true }
  ]
}
```

## Usage

```bash
# Run manually
node fetch-news.js

# Output saved to /tmp/latest-news.txt
cat /tmp/latest-news.txt

# Run tests
node test-news.js
```

## API Keys (Optional)

For Brave Search API (optional - script works without it):
```bash
export BRAVE_API_KEY="your-key-here"
```

## Project Structure

```
news/
├── fetch-news.js       # Main fetcher
├── github-upload.js    # GitHub repo upload
├── news-config.json    # Configuration
├── test-news.js        # Tests
└── README.md           # Full docs
```

## Status

- ✅ Security: Fixed (encodeURIComponent)
- ✅ Tests: 4 passing
- ✅ Verified: Fetches 15 headlines from 7 sources
