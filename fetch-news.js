#!/usr/bin/env node

/**
 * OpenClaw News Fetcher
 * Fetches top news from multiple sources and sends summary
 * 
 * Configuration: news-config.json (use BRAVE_API_KEY env var for API key)
 * Output: /tmp/latest-news.txt
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Paths
const CONFIG_FILE = path.join(__dirname, 'news-config.json');
const OUTPUT_FILE = '/tmp/latest-news.txt';

// Load config
let config;
try {
  const rawConfig = fs.readFileSync(CONFIG_FILE, 'utf8');
  config = JSON.parse(rawConfig);
  
  // Support environment variable substitution for API keys
  if (config.braveApiKey && config.braveApiKey.startsWith('${')) {
    const envVar = config.braveApiKey.match(/\$\{(\w+)\}/)[1];
    config.braveApiKey = process.env[envVar] || '';
  }
} catch (error) {
  console.error(`Error loading config: ${error.message}`);
  process.exit(1);
}

// Get gateway token from environment (security: use env var)
const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN || '';

/**
 * Send message via OpenClaw gateway
 */
async function sendNotification(message) {
  const notif = config.notifications;
  
  if (!notif || !notif.enabled) {
    console.log(`${colors.yellow}Notifications disabled${colors.reset}`);
    return;
  }
  
  const channel = notif.channel || 'whatsapp';
  const target = notif.target;
  
  if (!target) {
    console.log(`${colors.yellow}No notification target configured${colors.reset}`);
    return;
  }
  
  console.log(`${colors.cyan}Sending notification via ${channel}...${colors.reset}`);
  
  try {
    // Use openclaw CLI to send message
    const escapedMessage = message.replace(/"/g, '\\"');
    const cmd = `openclaw message send --channel ${channel} --target "${target}" -m "${escapedMessage}" --json`;
    
    const response = execSync(cmd, {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
      timeout: 20000,  // 20 second timeout
      env: { ...process.env, OPENCLAW_GATEWAY_TOKEN: gatewayToken }
    });
    
    const result = JSON.parse(response);
    
    if (result.messageId || result.id) {
      console.log(`${colors.green}✓ Notification sent (${result.messageId || result.id})${colors.reset}`);
    } else if (result.error) {
      console.log(`${colors.yellow}⚠ Notification error: ${result.error}${colors.reset}`);
    } else {
      console.log(`${colors.yellow}⚠ Notification response: ${response.substring(0, 200)}${colors.reset}`);
    }
    
  } catch (error) {
    console.log(`${colors.yellow}⚠ Failed to send notification: ${error.message}${colors.reset}`);
  }
}

// Colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

/**
 * Check if headline passes filters
 */
function passesFilters(headline) {
  const lower = headline.toLowerCase();
  const len = headline.length;
  const f = config.filter;
  
  // Length check
  if (len < f.minLength || len > f.maxLength) {
    return false;
  }
  
  // Pattern exclusion
  for (const pattern of f.excludePatterns) {
    if (lower.includes(pattern.toLowerCase())) {
      return false;
    }
  }
  
  // Keyword inclusion (if any keywords specified)
  if (f.keywords.length > 0) {
    const matches = f.keywords.some(k => lower.includes(k.toLowerCase()));
    if (!matches) return false;
  }
  
  return true;
}

/**
 * Clean headline text
 */
function cleanHeadline(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Fetch news from Brave Search API via OpenClaw Gateway
 */
async function fetchFromBrave(source) {
  console.log(`${colors.cyan}Fetching from Brave Search API (via gateway)...${colors.reset}`);
  
  try {
    // Try OpenClaw gateway API first
    const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL || 'http://127.0.0.1:18789';
    
    if (!gatewayToken) {
      throw new Error('OPENCLAW_GATEWAY_TOKEN not configured');
    }
    
    const query = source.query || 'top business finance news today';
    const searchUrl = `${gatewayUrl}/api/v1/tools/web/search?q=${encodeURIComponent(query)}&count=${source.maxHeadlines}`;
    
    const response = execSync(
      `curl -s "${searchUrl}" -H "Authorization: Bearer ${gatewayToken}" -H "Accept: application/json" --max-time ${config.timeout / 1000}`,
      {
        encoding: 'utf8',
        maxBuffer: 2 * 1024 * 1024
      }
    );
    
    const data = JSON.parse(response);
    const headlines = [];
    
    // Handle OpenClaw gateway response format
    if (data.results && Array.isArray(data.results)) {
      for (const result of data.results) {
        if (result.title && passesFilters(result.title)) {
          headlines.push(result.title);
        }
      }
    } else if (Array.isArray(data)) {
      // Direct array response
      for (const item of data) {
        if (item.title && passesFilters(item.title)) {
          headlines.push(item.title);
        }
      }
    }
    
    console.log(`${colors.green}  Found ${headlines.length} headlines${colors.reset}`);
    return headlines.slice(0, source.maxHeadlines);
    
  } catch (error) {
    console.log(`${colors.yellow}  Gateway unavailable (${error.message}), falling back to direct API...${colors.reset}`);
    
    // Fallback to direct API with proper headers
    try {
      const braveApiKey = config.braveApiKey;
      
      if (!braveApiKey) {
        throw new Error('BRAVE_API_KEY not configured (neither in config nor env var)');
      }
      
      const query = source.query || 'top business finance news today';
      
      const response = execSync(
        `curl -s "https://api.search.brave.com/v1/search?q=${encodeURIComponent(query)}&source=news&count=${source.maxHeadlines}" -H "Accept: application/json" -H "X-Subscription-Token: ${braveApiKey}" -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" --max-time ${config.timeout / 1000}`,
        {
          encoding: 'utf8',
          maxBuffer: 2 * 1024 * 1024
        }
      );
      
      const data = JSON.parse(response);
      const headlines = [];
      
      if (data.results && Array.isArray(data.results)) {
        for (const result of data.results) {
          if (result.title && passesFilters(result.title)) {
            headlines.push(result.title);
          }
        }
      }
      
      console.log(`${colors.green}  Found ${headlines.length} headlines${colors.reset}`);
      return headlines.slice(0, source.maxHeadlines);
      
    } catch (fallbackError) {
      console.log(`${colors.red}  Error: ${fallbackError.message}${colors.reset}`);
      return [];
    }
  }
}

/**
 * Fetch news from a URL
 */
async function fetchNews(source) {
  console.log(`${colors.cyan}Fetching from ${source.name}...${colors.reset}`);
  
  if (!source.enabled) {
    console.log(`${colors.yellow}  Skipped (disabled)${colors.reset}`);
    return [];
  }
  
  // Handle Brave Search API
  if (source.type === 'api' && source.api === 'brave') {
    return await fetchFromBrave(source);
  }
  
  try {
    const response = execSync(
      `curl -s -L "${source.url}" -H "User-Agent: ${config.userAgent}" --max-time ${config.timeout / 1000} 2>/dev/null`,
      {
        encoding: 'utf8',
        maxBuffer: 2 * 1024 * 1024
      }
    );
    
    const headlines = [];
    
    // Pattern 1: RSS <title> with CDATA or plain
    let match;
    // CDATA format: <title><![CDATA[...]]></title>
    const cdataRegex = /<title><!\[CDATA\[(.+?)\]\]><\/title>/gi;
    while ((match = cdataRegex.exec(response)) !== null) {
      const clean = cleanHeadline(match[1]);
      if (passesFilters(clean) && !headlines.includes(clean)) {
        headlines.push(clean);
      }
    }
    
    // Plain format: <title>...</title> inside <item> tags
    if (headlines.length < source.maxHeadlines) {
      // Match title tags anywhere in the response (handles RSS variations)
      const plainRegex = /<item[^>]*>[\s\S]*?<title>([^<]{30,200})<\/title>/gi;
      while ((match = plainRegex.exec(response)) !== null) {
        const clean = cleanHeadline(match[1]);
        if (passesFilters(clean) && !headlines.includes(clean)) {
          headlines.push(clean);
        }
      }
    }
    
    // Pattern 2: <h1-h4> elements
    if (headlines.length < source.maxHeadlines) {
      const hTags = response.match(/<h[1-4][^>]*>([^<]{30,200})<\/h[1-4]>/gi);
      if (hTags) {
        for (const h of hTags) {
          const clean = cleanHeadline(h);
          if (passesFilters(clean) && !headlines.includes(clean)) {
            headlines.push(clean);
          }
        }
      }
    }
    
    const filtered = headlines.slice(0, source.maxHeadlines);
    console.log(`${colors.green}  Found ${filtered.length} headlines${colors.reset}`);
    return filtered;
    
  } catch (error) {
    console.log(`${colors.red}  Error: ${error.message}${colors.reset}`);
    return [];
  }
}

/**
 * Summarize a headline
 */
function summarize(headline) {
  // Take first sentence or first 100 chars
  let summary = headline.split(/[.!?](?:\s+|$)/)[0].trim();
  if (summary.length > 100) {
    summary = summary.substring(0, 97) + '...';
  }
  return summary;
}

/**
 * Format news for WhatsApp (Markdown)
 */
function formatMarkdown(topNews, allNews, date, elapsed) {
  let message = `📰 **Morning News Summary** — ${date}

*Consolidated from ${allNews.length} sources, top ${topNews.length} stories:*

`;
  
  for (let i = 0; i < topNews.length; i++) {
    const item = topNews[i];
    message += `${i + 1}. ${item.headline}
`;
    message += `   Sources: ${item.sources.join(', ')}

`;
  }
  
  message += `---
*Auto-generated by OpenClaw* | Fetched in ${elapsed}s`;
  
  return message;
}

/**
 * Format news as JSON
 */
function formatJSON(topNews, allNews, date, elapsed, fetchResults) {
  return JSON.stringify({
    generated: new Date().toISOString(),
    date,
    summary: {
      sourcesConsolidated: allNews.length,
      topStories: topNews.length,
      fetchDurationSeconds: parseFloat(elapsed)
    },
    topStories: topNews.map((item, i) => ({
      rank: i + 1,
      headline: item.headline,
      sources: item.sources,
      sourceCount: item.sources.length
    })),
    rawSources: allNews.map(ns => ({
      source: ns.source,
      headlineCount: ns.headlines.length
    })),
    sourceResults: fetchResults.map(r => ({
      source: r.source,
      success: r.success,
      headlineCount: r.headlines?.length || 0
    }))
  }, null, 2);
}

/**
 * Format news as HTML
 */
function formatHTML(topNews, allNews, date, elapsed) {
  const stories = topNews.map((item, i) => `
    <article>
      <h3>${i + 1}. ${escapeHtml(item.headline)}</h3>
      <p class="sources">Sources: ${item.sources.map(s => escapeHtml(s)).join(', ')}</p>
    </article>
  `).join('');
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Morning News Summary - ${date}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
    h1 { color: #1a1a1a; border-bottom: 2px solid #0066cc; padding-bottom: 10px; }
    .meta { color: #666; font-size: 0.9em; margin-bottom: 20px; }
    article { background: white; padding: 15px; margin-bottom: 15px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    article h3 { margin: 0 0 10px 0; color: #333; }
    .sources { color: #666; font-size: 0.85em; margin: 0; }
    footer { text-align: center; color: #999; font-size: 0.8em; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
  </style>
</head>
<body>
  <h1>📰 Morning News Summary</h1>
  <p class="meta">${date} | ${allNews.length} sources | Top ${topNews.length} stories</p>
  ${stories}
  <footer>Auto-generated by OpenClaw | Fetched in ${elapsed}s</footer>
</body>
</html>`;
}

/**
 * Format news as plain text
 */
function formatPlain(topNews, allNews, date, elapsed) {
  let text = `MORNING NEWS SUMMARY - ${date}
${'='.repeat(40)}

Consolidated from ${allNews.length} sources, top ${topNews.length} stories:

`;
  
  for (let i = 0; i < topNews.length; i++) {
    const item = topNews[i];
    text += `${i + 1}. ${item.headline}
   Sources: ${item.sources.join(', ')}

`;
  }
  
  text += `${'='.repeat(40)}
Auto-generated by OpenClaw | Fetched in ${elapsed}s
`;
  
  return text;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return text.replace(/[&<>"']/g, c => map[c]);
}

/**
 * Get output path for format
 */
function getOutputPath(format) {
  const base = '/tmp/latest-news';
  const formats = {
    markdown: '.md',
    json: '.json',
    html: '.html',
    plain: '.txt'
  };
  return (base + (formats[format] || '.txt')).replace('/tmp/', '/tmp/news-');
}

/**
 * Fetch news from a source with retry logic
 */
async function fetchNewsWithRetry(source, maxRetries = 2) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const headlines = await fetchNews(source);
      if (headlines.length > 0) {
        return { source: source.name, headlines, success: true };
      }
      // Empty result on last attempt
      if (attempt === maxRetries) {
        return { source: source.name, headlines: [], success: false, error: 'No headlines after all retries' };
      }
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        console.log(`${colors.yellow}  Retry ${attempt}/${maxRetries} after error: ${error.message}${colors.reset}`);
        await new Promise(r => setTimeout(r, config.requestDelay * attempt)); // Exponential backoff
      }
    }
  }
  
  return { source: source.name, headlines: [], success: false, error: lastError?.message || 'Unknown error' };
}

/**
 * Main
 */
async function main() {
  console.log(`${colors.green}${colors.bold}📰 OpenClaw News Fetcher${colors.reset}`);
  console.log(`${colors.cyan}Running: ${new Date().toLocaleString()}${colors.reset}`);
  console.log(`${colors.cyan}Config: ${CONFIG_FILE}${colors.reset}\n`);
  
  const startTime = Date.now();
  
  // Fetch news from configured sources IN PARALLEL
  const enabledSources = config.sources.filter(s => s.enabled);
  console.log(`${colors.cyan}Fetching from ${enabledSources.length} sources in parallel...${colors.reset}\n`);
  
  const results = await Promise.all(
    enabledSources.map(source => fetchNewsWithRetry(source, 2))
  );
  
  // Filter to only successful fetches
  const allNews = results
    .filter(r => r.headlines.length > 0)
    .map(r => ({ source: r.source, headlines: r.headlines }));
  
  // Log summary of failures
  const failures = results.filter(r => r.headlines.length === 0);
  if (failures.length > 0) {
    console.log(`${colors.yellow}⚠ ${failures.length} source(s) failed:${colors.reset}`);
    failures.forEach(f => console.log(`  - ${f.source}: ${f.error}`));
  }
  
  if (allNews.length === 0) {
    console.log(`${colors.red}⚠️ No news fetched${colors.reset}`);
    fs.writeFileSync(OUTPUT_FILE, '⚠️ Could not fetch news this morning. Try again tomorrow.');
    return;
  }
  
  // Consolidate and rank news
  const topNews = consolidateNews(allNews);
  
  // Format consolidated news
  const date = new Date().toLocaleDateString('en-NZ', { 
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
  });
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  
  // Determine output formats from config (default: markdown for WhatsApp)
  const outputFormats = config.output?.formats || ['markdown'];
  
  // Generate output for each format
  const outputs = {
    markdown: formatMarkdown(topNews, allNews, date, elapsed),
    json: formatJSON(topNews, allNews, date, elapsed, results),
    html: formatHTML(topNews, allNews, date, elapsed),
    plain: formatPlain(topNews, allNews, date, elapsed)
  };
  
  // Write output files
  console.log(`\n${colors.green}${colors.bold}✓ Complete!${colors.reset}`);
  console.log(`${colors.cyan}Fetched from ${allNews.length}/${enabledSources.length} sources in ${elapsed}s${colors.reset}\n`);
  console.log(`${colors.cyan}Output formats:${colors.reset}`);
  
  for (const format of outputFormats) {
    if (outputs[format]) {
      const outputPath = getOutputPath(format);
      fs.writeFileSync(outputPath, outputs[format]);
      console.log(`  ${colors.green}✓${colors.reset} ${format.toUpperCase()}: ${outputPath}`);
    }
  }
  
  // Also write default /tmp/latest-news.txt for backward compatibility
  fs.writeFileSync(OUTPUT_FILE, outputs.markdown);
  console.log(`  ${colors.green}✓${colors.reset} DEFAULT: ${OUTPUT_FILE}`);
  
  // Record watchdog file for monitoring
  try {
    fs.writeFileSync('/tmp/news-fetcher-watchdog.json', JSON.stringify({
      lastRun: new Date().toISOString(),
      success: true,
      sourcesFetched: allNews.length,
      sourcesFailed: failures.length,
      durationSeconds: parseFloat(elapsed)
    }));
  } catch (e) {
    console.log(`${colors.yellow}⚠ Could not write watchdog file${colors.reset}`);
  }
}

// Run
main().catch(err => {
  console.error(`${colors.red}Error: ${err.message}${colors.reset}`);
  process.exit(1);
});


// ============================================================================
// NEWS CONSOLIDATION ALGORITHM
// ============================================================================

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
  'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as',
  'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'between', 'under', 'again', 'further', 'then', 'once', 'here',
  'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few',
  'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only',
  'own', 'same', 'so', 'than', 'too', 'very', 'just', 'also', 'now',
  'and', 'but', 'or', 'yet', 'if', 'because', 'although', 'while',
  'that', 'which', 'who', 'whom', 'this', 'these', 'those', 'it'
]);

function preprocessText(text) {
  return text.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 2 && !STOP_WORDS.has(word));
}

function jaccardSimilarity(tokens1, tokens2) {
  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  return union.size ? intersection.size / union.size : 0;
}

function getSimilarityThreshold() {
  return config.consolidation?.similarityThreshold ?? 0.5;
}

function groupSimilarHeadlines(allItems) {
  const threshold = getSimilarityThreshold();
  const clusters = [];
  const assigned = new Set();
  
  for (let i = 0; i < allItems.length; i++) {
    if (assigned.has(i)) continue;
    const cluster = [allItems[i]];
    assigned.add(i);
    
    for (let j = i + 1; j < allItems.length; j++) {
      if (assigned.has(j)) continue;
      const similarity = jaccardSimilarity(
        preprocessText(allItems[i].headline),
        preprocessText(allItems[j].headline)
      );
      if (similarity >= threshold) {
        cluster.push(allItems[j]);
        assigned.add(j);
      }
    }
    clusters.push(cluster);
  }
  return clusters;
}

function consolidateClusters(clusters) {
  const consolidated = [];
  for (const cluster of clusters) {
    const sources = new Set(cluster.map(item => item.source));
    const longest = cluster.reduce((a, b) => a.headline.length > b.headline.length ? a : b);
    consolidated.push({
      headline: longest.headline,
      sources: Array.from(sources),
      sourceCount: sources.size
    });
  }
  return consolidated;
}

function scoreItems(consolidatedItems) {
  const scoring = config.consolidation?.scoring ?? {};
  const sourceWeight = scoring.sourceCountWeight ?? 2.0;
  const recencyWeight = scoring.recencyWeight ?? 1.0;
  
  return consolidatedItems.map(item => {
    const sourceScore = item.sourceCount * sourceWeight;
    const totalScore = sourceScore + recencyWeight * 0.5;
    return { ...item, score: totalScore };
  }).sort((a, b) => b.score - a.score);
}

function consolidateNews(allHeadlines) {
  const maxItems = config.consolidation?.maxItems ?? config.maxItems ?? 3;
  
  const flatItems = allHeadlines.flatMap(ns => 
    ns.headlines.map(h => ({ source: ns.source, headline: h }))
  );
  
  console.log(`${colors.cyan}Consolidating ${flatItems.length} headlines...${colors.reset}`);
  
  const clusters = groupSimilarHeadlines(flatItems);
  console.log(`${colors.cyan}Grouped into ${clusters.length} clusters${colors.reset}`);
  
  const consolidated = consolidateClusters(clusters);
  const scored = scoreItems(consolidated);
  const topItems = scored.slice(0, maxItems);
  
  console.log(`${colors.green}Top ${topItems.length} stories:${colors.reset}`);
  for (const item of topItems) {
    console.log(`  [${item.score.toFixed(2)}] ${item.headline.substring(0, 50)}... (${item.sources.length} sources)`);
  }
  
  return topItems;
}
