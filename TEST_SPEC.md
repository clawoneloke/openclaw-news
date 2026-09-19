# Test Specification - OpenClaw News Fetcher

## Test Files

```
tests/
├── unit.test.js          # Unit tests for pure functions
├── integration.test.js  # Integration tests with mocked HTTP
└── run-tests.js         # Test runner
```

## Running Tests

```bash
npm test              # Run all tests
npm run test:unit     # Unit tests only
npm run test:integration  # Integration tests only
```

## Unit Tests (unit.test.js)

Tests pure functions without network/IO:

| Test | Description |
|------|-------------|
| `testJaccardSimilarity` | Jaccard coefficient calculation |
| `testPreprocessText` | Stop word removal, tokenization |
| `testGroupSimilarHeadlines` | Clustering logic |
| `testConsolidateClusters` | Source merging |
| `testScoreItems` | Scoring algorithm |
| `testPassesFilters` | Length, pattern, keyword filtering |
| `testCleanHeadline` | HTML entity decoding |
| `testEscapeHtml` | HTML special character escaping |
| `testFormatMarkdown` | Markdown output formatting |
| `testFormatJSON` | JSON output structure |
| `testFormatHTML` | HTML output structure |
| `testFormatPlain` | Plain text formatting |

## Integration Tests (integration.test.js)

Tests with mocked HTTP responses:

| Test | Description |
|------|-------------|
| `testRSSParsing` | RSS title extraction (CDATA + plain) |
| `testRSSParsingMixed` | Mixed CDATA/plain formats |
| `testBraveAPIResponse` | Brave Search API parsing |
| `testRetryLogic` | Retry with exponential backoff |
| `testFailedFetch` | Graceful failure handling |
| `testOutputPath` | Multiple format file paths |
| `testEscapeHtmlEdgeCases` | XSS prevention in HTML output |

### Mock Data

- `MOCK_RSS_BLOOMBERG`: RSS with CDATA titles
- `MOCK_RSS_CNBC`: RSS with plain titles
- `MOCK_RSS_ERROR`: Malformed RSS response

## Coverage Areas

### Core Algorithm
- Jaccard similarity computation
- Text preprocessing (stop words, tokenization)
- Clustering threshold behavior
- Scoring weight application

### Data Processing
- Headline cleaning (HTML entities, tags)
- Filter application (length, patterns, keywords)
- Source consolidation and merging

### Output Generation
- Markdown formatting for WhatsApp
- JSON structure with metadata
- HTML with escaping (XSS prevention)
- Plain text fallback

### Error Handling
- Network failures (retry with backoff)
- Malformed RSS responses
- Missing configuration
- API errors

## Test Patterns

### Assertion Helper
```javascript
function assert(condition, message) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}
```

### Mock execSync
```javascript
function mockExecSync(mockResponse, error = null) {
  const original = require('child_process').execSync;
  require('child_process').execSync = (cmd, options) => {
    if (cmd.includes('curl') && !error) return mockResponse;
    if (error) throw error;
    return mockResponse;
  };
  return () => { require('child_process').execSync = original; };
}
```

## CI/CD

- Pre-commit hook runs `npm test`
- Tests must pass before push
