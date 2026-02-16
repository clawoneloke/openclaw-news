#!/usr/bin/env node
/**
 * News Fetcher Watchdog
 * Monitors news fetcher health and restarts if needed
 */

const fs = require('fs');
const { execSync, exec } = require('child_process');

const WATCHDOG_FILE = '/tmp/news-fetcher-watchdog.json';
const MAX_AGE_HOURS = 25;  // Alert if no run in 25 hours (should run every 24)

function getLastRun() {
  try {
    if (fs.existsSync(WATCHDOG_FILE)) {
      const data = JSON.parse(fs.readFileSync(WATCHDOG_FILE, 'utf8'));
      return new Date(data.lastRun);
    }
  } catch (e) {}
  return null;
}

function setLastRun() {
  fs.writeFileSync(WATCHDOG_FILE, JSON.stringify({
    lastRun: new Date().toISOString()
  }));
}

function checkHealth() {
  const lastRun = getLastRun();
  const now = new Date();
  
  if (!lastRun) {
    console.log('⚠ No previous run found');
    return false;
  }
  
  const hoursSinceLastRun = (now - lastRun) / (1000 * 60 * 60);
  
  if (hoursSinceLastRun > MAX_AGE_HOURS) {
    console.log(`⚠ News fetcher may be stuck - last run ${hoursSinceLastRun.toFixed(1)} hours ago`);
    return false;
  }
  
  console.log(`✓ Last run: ${hoursSinceLastRun.toFixed(1)} hours ago`);
  return true;
}

function runWatchdog() {
  console.log('🔍 Checking news fetcher health...');
  
  const healthy = checkHealth();
  
  if (healthy) {
    setLastRun();
    process.exit(0);
  } else {
    // Try to restart
    console.log('Attempting to restart news fetcher...');
    try {
      exec('cd ~/.openclaw/workspace/news && node fetch-news.js', (error, stdout, stderr) => {
        if (error) {
          console.log(`❌ Restart failed: ${error.message}`);
          process.exit(1);
        }
        console.log('✓ News fetcher restarted');
        setLastRun();
        process.exit(0);
      });
    } catch (e) {
      console.log(`❌ Restart error: ${e.message}`);
      process.exit(1);
    }
  }
}

// Run
runWatchdog();
