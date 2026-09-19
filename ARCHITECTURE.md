# Architecture - OpenClaw News Fetcher

## System Overview

The news fetcher is a Node.js CLI that:
1. Fetches headlines from multiple RSS/API sources in parallel
2. Filters and cleans headlines
3. Consolidates similar stories using Jaccard similarity
4. Outputs in multiple formats (Markdown, JSON, HTML, plain text)

## Components

### fetch-news.js (Main)

**Responsibilities:**
- Configuration loading with env var substitution
- Parallel source fetching with retry logic
- News consolidation algorithm
- Multi-format output generation
- Watchdog file generation

**Key Functions:**
```
loadConfig()           → Parse JSON, substitute ${VAR} patterns
fetchNews(source)      → Fetch single source (RSS or Brave API)
fetchNewsWithRetry()   → Wrapper with exponential backoff (2 retries)
passesFilters()        → Length, pattern, keyword filtering
cleanHeadline()        → HTML entity decode, tag strip
consolidateNews()      → Main consolidation pipeline
formatMarkdown/JSON/HTML/plain → Output formatters
```

### watchdog.js (Health Monitor)

**Responsibilities:**
- Check last successful run timestamp
- Verify news output file age
- Send alerts via WhatsApp on failure

**Exit Codes:**
- `0`: Healthy (run within 26 hours)
- `1`: Unhealthy (stale >26h or critical >30h)
- `2`: Error (file read failures)

### news-config.json (Configuration)

**Sections:**
- `maxItems`: Number of top stories to return
- `braveApiKey`: Brave Search API key (env var)
- `output.formats`: Array of output formats
- `sources`: Array of RSS/API sources
- `filter`: Headline filtering rules
- `consolidation`: Similarity and scoring config

## Data Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Config     │────▶│   Fetch      │────▶│   Filter     │
│ (JSON + env) │     │  (parallel)  │     │  (length,    │
└──────────────┘     └──────────────┘     │   patterns)  │
                                           └──────────────┘
                                                │
                                                ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Output     │◀────│   Score &    │◀────│ Consolidate  │
│  (multi-     │     │   Rank       │     │  (Jaccard)   │
│   format)    │     └──────────────┘     └──────────────┘
└──────────────┘
```

## Consolidation Algorithm

1. **Flatten**: Convert source headlines to `{source, headline}` pairs
2. **Preprocess**: Lowercase, strip punctuation, remove stop words
3. **Cluster**: Group headlines with Jaccard similarity ≥ threshold (0.5)
4. **Merge**: For each cluster, pick longest headline, merge source lists
5. **Score**: `score = sourceCount × 2.0 + recency × 1.0`
6. **Rank**: Sort by score descending, return top N

## Security

- API keys stored in environment variables (`${BRAVE_API_KEY}`)
- No hardcoded credentials (commit 61dc958)
- Gateway token via `OPENCLAW_GATEWAY_TOKEN` env var
- .gitignore prevents credential exposure (commit be72f21)

## Testing

- **Unit tests** (`unit.test.js`): Algorithm, filtering, formatting
- **Integration tests** (`integration.test.js`): RSS parsing, retry logic, edge cases
- **Test runner** (`run-tests.js`): Orchestrates all tests

## Dependencies

- Node.js built-ins: `fs`, `path`, `child_process`
- No external npm packages (lightweight)
