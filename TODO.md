# TODO - OpenClaw News Fetcher

## Completed (Recent)

- [x] Configurable output formats (JSON, Markdown, HTML, plain text) - commit b1e728c
- [x] Parallel fetching - commit 9b2a503
- [x] Retry logic with exponential backoff - commit 9b2a503, 98f5a9e
- [x] News consolidation algorithm with Jaccard similarity - commit 7037a48
- [x] escapeHtml function for HTML output - commit 98f5a9e
- [x] Watchdog health monitoring - commit c448cd5
- [x] WhatsApp integration - commit c448cd5
- [x] Security audit and fixes - commit b6e3505, 61dc958, be72f21

## In Progress

- None

## Backlog

### High Priority

- [ ] Add more news sources (Reuters, FT, MarketWatch)
- [ ] Implement recency scoring (use publication date from RSS)
- [ ] Add caching to avoid refetching same content

### Medium Priority

- [ ] Add engagement scoring (if social signals available)
- [ ] Implement rate limiting per source
- [ ] Add source health tracking (success rate per source)
- [ ] Email notification support

### Low Priority

- [ ] Web dashboard for viewing historical news
- [ ] Topic-based filtering (tech, crypto, markets)
- [ ] Export to PDF format
- [ ] Slack integration

## Known Issues

- Brave Search API fallback sometimes fails (network-dependent)
- Some RSS feeds have inconsistent formatting

## Future Ideas

- ML-based headline summarization
- Sentiment analysis per story
- Multi-language support
- Personalized news based on keywords
