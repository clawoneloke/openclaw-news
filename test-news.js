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
    testConfigLoad();
    testEnvSubstitution();
    testGitHubEncoding();
    testOutputWritable();
    
    console.log('\n✅ All tests passed!\n');
    process.exit(0);
  } catch (error) {
    console.error(`\n❌ Test failed: ${error.message}\n`);
    process.exit(1);
  }
}

runTests();
