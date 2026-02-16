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
 * With error handling
 */
async function fetchFromBrave(source) {
  try {
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
  
  // Format and save
  const message = formatNews(allNews);
  fs.writeFileSync(OUTPUT_FILE, message);
  
  console.log(`\n${colors.green}${colors.bold}✓ Complete!${colors.reset}`);
  console.log(`${colors.cyan}Output: ${OUTPUT_FILE}${colors.reset}`);
}

// Run
main().catch(err => {
  console.error(`${colors.red}Error: ${err.message}${colors.reset}`);
  process.exit(1);
});


/**
 * Send news summary via WhatsApp
 */
async function sendWhatsAppNotification(newsItems) {
  if (newsItems.length === 0) {
    console.log(`${colors.yellow}No news items to send${colors.reset}`);
    return;
  }
  
  // Format message
  let message = '📰 *Daily News Summary*\n\n';
  
  for (const item of newsItems.slice(0, 5)) {  // Max 5 items
    message += `• ${item.headline.substring(0, 80)}${item.headline.length > 80 ? '...' : ''}\n`;
    message += `  (${item.source})\n\n`;
  }
  
  if (newsItems.length > 5) {
    message += `_...and ${newsItems.length - 5} more_`;
  }
  
  // Send via OpenClaw CLI
  try {
    const { execSync } = require('child_process');
    const escapedMessage = message.replace(/"/g, '\\"').replace(/\n/g, '\\n');
    
    execSync(
      `openclaw message send --message "${escapedMessage}" --channel whatsapp`,
      { encoding: 'utf8', timeout: 30000 }
    );
    console.log(`${colors.green}✓ WhatsApp notification sent${colors.reset}`);
  } catch (error) {
    console.log(`${colors.yellow}⚠ WhatsApp notification failed: ${error.message}${colors.reset}`);
  }
}
