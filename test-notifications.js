#!/usr/bin/env node
/**
 * Tests for openclaw-news notification system
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const NEWS_DIR = path.join(__dirname);
const FLAG_FILE = '/tmp/news-notification.flag';
const NEWS_FILE = '/tmp/latest-news.txt';

const tests = [
  {
    name: 'News directory exists',
    fn: () => fs.existsSync(NEWS_DIR)
  },
  {
    name: 'fetch-news.js exists',
    fn: () => fs.existsSync(path.join(NEWS_DIR, 'fetch-news.js'))
  },
  {
    name: 'send-news.sh exists',
    fn: () => fs.existsSync(path.join(NEWS_DIR, 'send-news.sh'))
  },
  {
    name: 'send-news.sh is executable',
    fn: () => {
      const stats = fs.statSync(path.join(NEWS_DIR, 'send-news.sh'));
      return (stats.mode & 0o111) !== 0;
    }
  },
  {
    name: 'news-config.json exists',
    fn: () => fs.existsSync(path.join(NEWS_DIR, 'news-config.json'))
  },
  {
    name: 'news-config.json has notifications config',
    fn: () => {
      const config = JSON.parse(fs.readFileSync(path.join(NEWS_DIR, 'news-config.json'), 'utf8'));
      return config.notifications && config.notifications.enabled !== undefined;
    }
  },
  {
    name: 'news-config.json has correct target',
    fn: () => {
      const config = JSON.parse(fs.readFileSync(path.join(NEWS_DIR, 'news-config.json'), 'utf8'));
      return config.notifications && config.notifications.target === '+64220621342';
    }
  },
  {
    name: 'Notification flag file can be created',
    fn: () => {
      fs.writeFileSync(FLAG_FILE, '1');
      return fs.existsSync(FLAG_FILE);
    }
  },
  {
    name: 'Notification flag file can be cleaned up',
    fn: () => {
      if (fs.existsSync(FLAG_FILE)) {
        fs.unlinkSync(FLAG_FILE);
      }
      return !fs.existsSync(FLAG_FILE);
    }
  },
  {
    name: 'send-news.sh handles missing flag gracefully',
    fn: () => {
      // Ensure flag doesn't exist
      if (fs.existsSync(FLAG_FILE)) {
        fs.unlinkSync(FLAG_FILE);
      }
      // Run script - should exit cleanly
      try {
        execSync(path.join(NEWS_DIR, 'send-news.sh'), { timeout: 5000 });
        return true;
      } catch (e) {
        return e.status === 0; // May have non-zero but that's ok for no flag
      }
    }
  }
];

console.log('Running openclaw-news notification tests...\n');

let passed = 0;
let failed = 0;

for (const test of tests) {
  try {
    const result = test.fn();
    if (result) {
      console.log(`✓ ${test.name}`);
      passed++;
    } else {
      console.log(`✗ ${test.name}`);
      failed++;
    }
  } catch (e) {
    console.log(`✗ ${test.name}: ${e.message}`);
    failed++;
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
