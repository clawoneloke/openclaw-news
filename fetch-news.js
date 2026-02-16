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
 * Format news for sending
 */
function formatNews(allNews) {
  const date = new Date().toLocaleDateString('en-NZ', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  let message = `📰 **Morning News Summary** — ${date}\n\n`;
  
  let count = 1;
  for (const news of allNews) {
    if (news.headlines.length > 0) {
      message += `**${news.source}**\n`;
      for (const headline of news.headlines) {
        message += `${count}. ${summarize(headline)}\n`;
        count++;
      }
      message += '\n';
    }
  }
  
  // Trim to maxItems if configured
  if (config.maxItems && config.maxItems > 0) {
    const lines = message.split('\n');
    const headlinesOnly = lines.filter(l => /^\d+\.\s/.test(l));
    if (headlinesOnly.length > config.maxItems) {
      // Rebuild message with only top items
      message = `📰 **Morning News Summary** — ${date}\n\n`;
      count = 1;
      for (const news of allNews) {
        if (news.headlines.length > 0) {
          message += `**${news.source}**\n`;
          for (const headline of news.headlines.slice(0, config.maxItems - (count - 1))) {
            if (count > config.maxItems) break;
            message += `${count}. ${summarize(headline)}\n`;
            count++;
          }
          message += '\n';
        }
      }
    }
  }
  
  message += `---\n*Auto-generated by OpenClaw*`;
  
  return message;
}

/**
 * Main
 */
async function main() {
  console.log(`${colors.green}${colors.bold}📰 OpenClaw News Fetcher${colors.reset}`);
  console.log(`${colors.cyan}Running: ${new Date().toLocaleString()}${colors.reset}`);
  console.log(`${colors.cyan}Config: ${CONFIG_FILE}${colors.reset}\n`);
  
  // Fetch news from configured sources
  const allNews = [];
  
  for (const source of config.sources) {
    const headlines = await fetchNews(source);
    if (headlines.length > 0) {
      allNews.push({ source: source.name, headlines });
    }
    // Delay between sources
    await new Promise(r => setTimeout(r, config.requestDelay));
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
  
  let message = `📰 **Morning News Summary** — ${date}

`;
  message += `*Consolidated from ${allNews.length} sources, top ${topNews.length} stories:*

`;
  
  for (let i = 0; i < topNews.length; i++) {
    const item = topNews[i];
    message += `${i + 1}. ${item.headline}
`;
    message += `   Sources: ${item.sources.join(', ')}

`;
  }
  
  message += `---
*Auto-generated by OpenClaw*`;
  
  fs.writeFileSync(OUTPUT_FILE, message);
  
  console.log(`\n${colors.green}${colors.bold}✓ Complete!${colors.reset}`);
  console.log(`${colors.cyan}Output: ${OUTPUT_FILE}${colors.reset}`);
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
