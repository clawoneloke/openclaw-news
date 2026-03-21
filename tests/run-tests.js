#!/usr/bin/env node
/**
 * Test Runner for openclaw-news
 * Runs both unit and integration tests
 */

const { execSync } = require('child_process');
const path = require('path');

function runTests(name, testFile) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Running: ${name}`);
  console.log('='.repeat(60));
  
  try {
    execSync(`node "${testFile}"`, { 
      cwd: path.dirname(testFile),
      stdio: 'inherit'
    });
    return true;
  } catch (error) {
    console.error(`❌ ${name} failed`);
    return false;
  }
}

console.log('\n🧪 OpenClaw News - Test Suite\n');

const testsDir = path.join(__dirname);
const results = [];

results.push(runTests('Unit Tests', path.join(testsDir, 'unit.test.js')));
results.push(runTests('Integration Tests', path.join(testsDir, 'integration.test.js')));

console.log('\n' + '='.repeat(60));
console.log('Test Summary');
console.log('='.repeat(60));

const passed = results.filter(r => r).length;
const failed = results.filter(r => !r).length;

console.log(`\n✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);

process.exit(failed > 0 ? 1 : 0);
