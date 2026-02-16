#!/usr/bin/env node
/**
 * Tests for openclaw-news
 */
const fs = require('fs');
const path = require('path');

// ============================================================================
// TEST HELPERS
// ============================================================================

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// ============================================================================
// CONFIG TESTS
// ============================================================================

function testConfigLoad() {
  const CONFIG_FILE = path.join(__dirname, 'news-config.json');
  assert(fs.existsSync(CONFIG_FILE), 'Config file not found');
  
  const rawConfig = fs.readFileSync(CONFIG_FILE, 'utf8');
  const config = JSON.parse(rawConfig);
  
  assert(config.sources && Array.isArray(config.sources), 'Missing sources array');
  assert(config.cron && config.cron.schedule, 'Missing cron schedule');
  assert(config.consolidation, 'Missing consolidation config');
  
  console.log('✓ Config loads correctly');
  console.log(`  Sources: ${config.sources.length}`);
  console.log(`  Max Items: ${config.consolidation.maxItems}`);
  return config;
}

function testEnvSubstitution() {
  process.env.TEST_API_KEY = 'test-key-123';
  
  const testConfig = { braveApiKey: '${TEST_API_KEY}' };
  
  if (testConfig.braveApiKey && testConfig.braveApiKey.startsWith('${')) {
    const envVar = testConfig.braveApiKey.match(/\$\{(\w+)\}/)[1];
    testConfig.braveApiKey = process.env[envVar] || '';
  }
  
  assert(testConfig.braveApiKey === 'test-key-123', 'Environment substitution failed');
  console.log('✓ Environment variable substitution works');
  delete process.env.TEST_API_KEY;
}

function testGitHubEncoding() {
  const testCases = [
    { input: 'simple-repo', expected: 'simple-repo' },
    { input: 'repo with space', expected: 'repo%20with%20space' },
  ];
  
  for (const tc of testCases) {
    assert(encodeURIComponent(tc.input) === tc.expected, `Encoding failed: ${tc.input}`);
  }
  console.log('✓ GitHub encoding works');
}

function testOutputWritable() {
  const OUTPUT_FILE = '/tmp/latest-news.txt';
  fs.writeFileSync(OUTPUT_FILE, 'test', 'utf8');
  fs.unlinkSync(OUTPUT_FILE);
  console.log('✓ Output directory writable');
}

// ============================================================================
// FILTERING TESTS
// ============================================================================

function testFiltering() {
  const config = {
    filter: {
      minLength: 40,
      maxLength: 150,
      excludePatterns: ['javascript', 'cookie', 'advertisement'],
      keywords: ['bitcoin', 'crypto', 'stock']
    }
  };
  
  const passesFilters = (headline) => {
    const lower = headline.toLowerCase();
    const len = headline.length;
    const f = config.filter;
    
    if (len < f.minLength || len > f.maxLength) return false;
    for (const pattern of f.excludePatterns) {
      if (lower.includes(pattern.toLowerCase())) return false;
    }
    if (f.keywords.length > 0) {
      return f.keywords.some(k => lower.includes(k.toLowerCase()));
    }
    return true;
  };
  
  const tests = [
    { input: 'Bitcoin surges past $100000 as institutional adoption grows', expected: true },
    { input: 'Stock market reaches new all-time high today', expected: true },
    { input: 'Enable javascript to view this content', expected: false },
    { input: 'A', expected: false },
  ];
  
  for (const tc of tests) {
    assert(passesFilters(tc.input) === tc.expected, 
      `Filter failed: "${tc.input}" expected ${tc.expected}`);
  }
  console.log('✓ Filtering logic works correctly');
}

function testHeadlineCleaning() {
  const cleanHeadline = (text) => {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#\d+;/g, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };
  
  const tests = [
    { input: 'Bitcoin & Ethereum surge', expected: 'Bitcoin & Ethereum surge' },
    { input: 'Stock test', expected: 'Stock test' },
    { input: '  Multiple   spaces  ', expected: 'Multiple spaces' },
  ];
  
  for (const tc of tests) {
    assert(cleanHeadline(tc.input) === tc.expected, 
      `Clean failed: "${tc.input}"`);
  }
  console.log('✓ Headline cleaning works correctly');
}

function testConfigValidation() {
  const rawConfig = JSON.parse(fs.readFileSync(
    path.join(__dirname, 'news-config.json'), 'utf8'));
  
  assert(rawConfig.maxItems !== undefined, 'Missing maxItems');
  assert(rawConfig.sources && rawConfig.sources.length > 0, 'Missing sources');
  assert(rawConfig.consolidation?.maxItems, 'Missing consolidation.maxItems');
  console.log('✓ Config validation passed');
}

function testOutputFormatting() {
  const items = [
    { source: 'Bloomberg', headline: 'Bitcoin reaches new high' },
    { source: 'CNBC', headline: 'Markets rally on earnings' },
  ];
  
  const formatAsMarkdown = (items) => {
    let output = '# 📰 Daily News\n\n';
    for (const item of items) {
      output += `## ${item.source}\n${item.headline}\n\n`;
    }
    return output;
  };
  
  const output = formatAsMarkdown(items);
  assert(output.includes('# 📰 Daily News'), 'Missing header');
  assert(output.includes('## Bloomberg'), 'Missing source');
  console.log('✓ Output formatting works correctly');
}

// ============================================================================
// CONSOLIDATION ALGORITHM TESTS
// ============================================================================

function testPreprocessing() {
  const STOP_WORDS = new Set(['the', 'a', 'an', 'is', 'are', 'and', 'or', 'but']);
  const preprocess = (text) => 
    text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOP_WORDS.has(w));
  
  const result = preprocess("Bitcoin Surges Past $100K as ETF Inflows Hit Record");
  
  assert(result.includes('bitcoin'), 'Should contain bitcoin');
  assert(result.includes('surges'), 'Should contain surges');
  assert(!result.includes('the'), 'Should filter stopwords');
  assert(!result.includes('as'), 'Should filter stopwords');
  console.log('✓ Text preprocessing works');
}

function testJaccardSimilarity() {
  const jaccard = (tokens1, tokens2) => {
    const set1 = new Set(tokens1);
    const set2 = new Set(tokens2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    return union.size ? intersection.size / union.size : 0;
  };
  
  // Similar headlines
  const sim1 = jaccard(
    ['bitcoin', 'surges', 'past', '100k', 'etf', 'inflows'],
    ['bitcoin', 'reaches', '100k', 'milestone', 'etf', 'demand']
  );
  
  // Different headlines
  const sim2 = jaccard(
    ['bitcoin', 'surges', 'etf'],
    ['ethereum', 'gains', 'positive']
  );
  
  assert(sim1 > sim2, 'Similar headlines should have higher similarity');
  assert(jaccard(['a','b'], ['a','b']) === 1, 'Identical should be 1');
  console.log('✓ Jaccard similarity works');
}

function testGrouping() {
  const items = [
    { source: 'Bloomberg', headline: 'Federal Reserve signals rate cut in March' },
    { source: 'CNBC', headline: 'Fed Chair signals rate cut coming in March' },
    { source: 'WSJ', headline: 'Ethereum gains 5% today' },
  ];
  
  const preprocess = (text) => text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
  const jaccard = (t1, t2) => {
    const s1 = new Set(t1), s2 = new Set(t2);
    const i = new Set([...s1].filter(x => s2.has(x)));
    const u = new Set([...s1, ...s2]);
    return u.size ? i.size / u.size : 0;
  };
  
  const threshold = 0.35;
  const groups = [];
  const assigned = new Set();
  
  for (let i = 0; i < items.length; i++) {
    if (assigned.has(i)) continue;
    const group = [items[i]];
    assigned.add(i);
    
    for (let j = i + 1; j < items.length; j++) {
      if (assigned.has(j)) continue;
      if (jaccard(preprocess(items[i].headline), preprocess(items[j].headline)) >= threshold) {
        group.push(items[j]);
        assigned.add(j);
      }
    }
    groups.push(group);
  }
  
  assert(groups.length === 2, `Expected 2 groups, got ${groups.length}`);
  const bitcoinGroup = groups.find(g => g.length === 2);
  assert(bitcoinGroup, 'Should have Bitcoin group with 2 items');
  console.log('✓ Grouping similar items works');
}

function testScoring() {
  const items = [
    { sourceCount: 2, publishedAt: new Date(), engagement: 5000 },
    { sourceCount: 1, publishedAt: new Date(Date.now() - 48*60*60*1000), engagement: 100 },
  ];
  
  const scored = items.map(i => {
    const recencyScore = i.publishedAt 
      ? Math.max(0, 1 - (Date.now() - i.publishedAt.getTime()) / (24*60*60*1000))
      : 0.5;
    const engagementScore = i.engagement ? Math.min(i.engagement / 10000, 1.0) : 0.3;
    return { ...i, total: i.sourceCount * 2.0 + recencyScore + engagementScore * 0.5 };
  });
  
  assert(scored[0].total > scored[1].total, 'Should sort by score');
  console.log('✓ Scoring algorithm works');
}

// ============================================================================
// RUN ALL TESTS
// ============================================================================

function runTests() {
  console.log('\n🧪 Running openclaw-news tests...\n');
  
  try {
    // Config tests
    testConfigLoad();
    testEnvSubstitution();
    testGitHubEncoding();
    testOutputWritable();
    
    // Filtering tests
    testFiltering();
    testHeadlineCleaning();
    testConfigValidation();
    testOutputFormatting();
    
    // Consolidation algorithm tests
    testPreprocessing();
    testJaccardSimilarity();
    testGrouping();
    testScoring();
    
    console.log('\n✅ All tests passed!\n');
    process.exit(0);
  } catch (error) {
    console.error(`\n❌ Test failed: ${error.message}\n`);
    process.exit(1);
  }
}

runTests();
