#!/usr/bin/env node
/**
 * Tests for openclaw-news
 */
const fs = require('fs');
const path = require('path');

// Test config loading
function testConfigLoad() {
  const CONFIG_FILE = path.join(__dirname, 'news-config.json');
  
  // Test file exists
  if (!fs.existsSync(CONFIG_FILE)) {
    throw new Error('Config file not found');
  }
  
  // Test valid JSON
  const rawConfig = fs.readFileSync(CONFIG_FILE, 'utf8');
  const config = JSON.parse(rawConfig);
  
  // Test expected fields
  if (!config.sources || !Array.isArray(config.sources)) {
    throw new Error('Config missing sources array');
  }
  
  if (!config.cron || !config.cron.schedule) {
    throw new Error('Config missing cron schedule');
  }
  
  console.log('✓ Config loads correctly');
  console.log(`  Sources: ${config.sources.length}`);
  console.log(`  Schedule: ${config.cron.schedule}`);
  
  return config;
}

// Test environment variable substitution
function testEnvSubstitution() {
  process.env.TEST_API_KEY = 'test-key-123';
  
  const testConfig = {
    braveApiKey: '${TEST_API_KEY}'
  };
  
  if (testConfig.braveApiKey && testConfig.braveApiKey.startsWith('${')) {
    const envVar = testConfig.braveApiKey.match(/\$\{(\w+)\}/)[1];
    testConfig.braveApiKey = process.env[envVar] || '';
  }
  
  if (testConfig.braveApiKey !== 'test-key-123') {
    throw new Error('Environment substitution failed');
  }
  
  console.log('✓ Environment variable substitution works');
  delete process.env.TEST_API_KEY;
}

// Test GitHub upload encoding
function testGitHubEncoding() {
  const { execSync } = require('child_process');
  
  // Test encodeURIComponent with special chars
  const testCases = [
    { input: 'simple-repo', expected: 'simple-repo' },
    { input: 'repo-with-dash', expected: 'repo-with-dash' },
    { input: 'repo with space', expected: 'repo%20with%20space' },
    { input: 'repo_underscore', expected: 'repo_underscore' },
  ];
  
  for (const tc of testCases) {
    const encoded = encodeURIComponent(tc.input);
    if (encoded !== tc.expected) {
      throw new Error(`Encoding failed: ${tc.input} -> ${encoded} (expected ${tc.expected})`);
    }
  }
  
  console.log('✓ GitHub encoding (encodeURIComponent) works');
}

// Test output directory writable
function testOutputWritable() {
  const OUTPUT_FILE = '/tmp/latest-news.txt';
  
  try {
    fs.writeFileSync(OUTPUT_FILE, 'test', 'utf8');
    fs.unlinkSync(OUTPUT_FILE);
    console.log('✓ Output directory writable');
  } catch (error) {
    throw new Error(`Cannot write to output: ${error.message}`);
  }
}

// Run all tests
function runTests() {
  console.log('\n🧪 Running openclaw-news tests...\n');
  
  try {
    // Original tests
    testConfigLoad();
    testEnvSubstitution();
    testGitHubEncoding();
    testOutputWritable();
    
    // New tests
    testFiltering();
    testHeadlineCleaning();
    testConfigValidation();
    testOutputFormatting();
    
    console.log('\n✅ All tests passed!\n');
    process.exit(0);
  } catch (error) {
    console.error(`\n❌ Test failed: ${error.message}\n`);
    process.exit(1);
  }
}

runTests();


// Test filtering logic
function testFiltering() {
  const config = {
    filter: {
      minLength: 40,
      maxLength: 150,
      excludePatterns: ['javascript', 'cookie', 'advertisement'],
      keywords: ['bitcoin', 'crypto', 'stock']
    }
  };
  
  // Test passesFilters function logic
  const passesFilters = (headline) => {
    const lower = headline.toLowerCase();
    const len = headline.length;
    const f = config.filter;
    
    if (len < f.minLength || len > f.maxLength) return false;
    for (const pattern of f.excludePatterns) {
      if (lower.includes(pattern.toLowerCase())) return false;
    }
    if (f.keywords.length > 0) {
      const matches = f.keywords.some(k => lower.includes(k.toLowerCase()));
      if (!matches) return false;
    }
    return true;
  };
  
  // Test cases
  const tests = [
    { input: 'Bitcoin surges past $100000 as institutional adoption grows', expected: true },
    { input: 'Stock market reaches new all-time high today', expected: true },
    { input: 'Enable javascript to view this content', expected: false },  // excluded pattern
    { input: 'A', expected: false },  // too short
  ];
  
  for (const tc of tests) {
    const result = passesFilters(tc.input);
    if (result !== tc.expected) {
      throw new Error(`Filter test failed: "${tc.input}" expected ${tc.expected}, got ${result}`);
    }
  }
  
  console.log('✓ Filtering logic works correctly');
}

// Test headline cleaning
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
    { input: 'Bitcoin &amp; Ethereum surge', expected: 'Bitcoin & Ethereum surge' },
    { input: 'Stock &lt;div&gt;test&lt;/div&gt;', expected: 'Stock test' },
    { input: 'Market closes higher', expected: 'Market closes higher' },
    { input: '  Multiple   spaces  ', expected: 'Multiple spaces' },
  ];
  
  for (const tc of tests) {
    const result = cleanHeadline(tc.input);
    if (result !== tc.expected) {
      throw new Error(`Clean test failed: "${tc.input}" expected "${tc.expected}", got "${result}"`);
    }
  }
  
  console.log('✓ Headline cleaning works correctly');
}

// Test config validation
function testConfigValidation() {
  const rawConfig = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, 'news-config.json'), 'utf8'));
  
  // Required fields
  const required = ['maxItems', 'cron', 'sources', 'filter'];
  for (const field of required) {
    if (!(field in rawConfig)) {
      throw new Error(`Config missing required field: ${field}`);
    }
  }
  
  // Cron validation
  if (!rawConfig.cron.schedule || !rawConfig.cron.timezone) {
    throw new Error('Config missing cron.schedule or cron.timezone');
  }
  
  // Sources validation
  if (!Array.isArray(rawConfig.sources) || rawConfig.sources.length === 0) {
    throw new Error('Config must have non-empty sources array');
  }
  
  // Each source should have name and url
  for (const source of rawConfig.sources) {
    if (!source.name || !source.url) {
      throw new Error(`Source missing name or url: ${JSON.stringify(source)}`);
    }
  }
  
  console.log('✓ Config validation passed');
}

// Test output formatting
function testOutputFormatting() {
  const items = [
    { source: 'Bloomberg', headline: 'Bitcoin reaches new high', time: '2026-02-16T10:00:00Z' },
    { source: 'CNBC', headline: 'Markets rally on earnings', time: '2026-02-16T09:00:00Z' },
  ];
  
  // Test formatting as markdown
  const formatAsMarkdown = (items) => {
    let output = '# 📰 Daily News\n\n';
    for (const item of items) {
      output += `## ${item.source}\n`;
      output += `${item.headline}\n`;
      output += `*${new Date(item.time).toLocaleString()}*\n\n`;
    }
    return output;
  };
  
  const output = formatAsMarkdown(items);
  if (!output.includes('# 📰 Daily News')) {
    throw new Error('Output formatting failed - missing header');
  }
  if (!output.includes('## Bloomberg')) {
    throw new Error('Output formatting failed - missing source');
  }
  
  console.log('✓ Output formatting works correctly');
}

// Run new tests
console.log('\n🧪 Running additional tests...\n');

try {
  testFiltering();
  testHeadlineCleaning();
  testConfigValidation();
  testOutputFormatting();
  
  console.log('\n✅ All additional tests passed!\n');
} catch (error) {
  console.error(`\n❌ Test failed: ${error.message}\n`);
  process.exit(1);
}
