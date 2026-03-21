#!/usr/bin/env node
/**
 * News Watchdog - Alerts when news fetcher hasn't run
 * Run via separate cron to monitor health
 * 
 * Usage: node watchdog.js
 * Exit codes: 0 = healthy, 1 = unhealthy, 2 = error
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const WATCHDOG_FILE = '/tmp/news-fetcher-watchdog.json';
const OUTPUT_FILE = '/tmp/latest-news.txt';
const MAX_AGE_HOURS = 26; // Alert if no run in 26 hours
const ALERT_THRESHOLD_HOURS = 30; // Critical if no run in 30 hours

function getLastRun() {
  try {
    if (fs.existsSync(WATCHDOG_FILE)) {
      const data = JSON.parse(fs.readFileSync(WATCHDOG_FILE, 'utf8'));
      return {
        timestamp: new Date(data.lastRun),
        hoursAgo: (Date.now() - new Date(data.lastRun).getTime()) / (1000 * 60 * 60),
        success: data.success !== false
      };
    }
  } catch (e) {}
  return null;
}

function checkNewsFile() {
  try {
    if (fs.existsSync(OUTPUT_FILE)) {
      const stats = fs.statSync(OUTPUT_FILE);
      const ageHours = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);
      return {
        exists: true,
        ageHours,
        mtime: stats.mtime
      };
    }
  } catch (e) {}
  return { exists: false, ageHours: null };
}

function sendAlert(message) {
  try {
    const target = process.env.NEWS_WATCHDOG_ALERT_TARGET || '+64220621342';
    const escapedMessage = message.replace(/"/g, '\\"');
    const cmd = `openclaw message send --channel whatsapp --target "${target}" -m "${escapedMessage}" --json`;
    
    execSync(cmd, {
      encoding: 'utf8',
      timeout: 15000,
      env: { ...process.env }
    });
    return true;
  } catch (error) {
    console.error(`Alert failed: ${error.message}`);
    return false;
  }
}

function checkHealth() {
  const lastRun = getLastRun();
  const newsFile = checkNewsFile();
  const now = new Date();
  
  console.log('🔍 News Fetcher Watchdog');
  console.log(`   Time: ${now.toLocaleString()}`);
  console.log('');
  
  if (!lastRun) {
    console.log('⚠️  No previous run recorded');
    return { healthy: false, reason: 'no_history' };
  }
  
  console.log(`📰 Last run: ${lastRun.timestamp.toLocaleString()} (${lastRun.hoursAgo.toFixed(1)} hours ago)`);
  console.log(`📄 News file: ${newsFile.exists ? `${newsFile.ageHours.toFixed(1)} hours old` : 'not found'}`);
  console.log('');
  
  // Critical: No run in 30+ hours
  if (lastRun.hoursAgo > ALERT_THRESHOLD_HOURS) {
    console.log('🔴 CRITICAL: No news run in 30+ hours!');
    const alertMsg = `🚨 News Watchdog ALERT: No news fetcher run in ${lastRun.hoursAgo.toFixed(1)} hours. Last successful run: ${lastRun.timestamp.toLocaleString()}`;
    sendAlert(alertMsg);
    return { healthy: false, reason: 'critical_no_run', hoursAgo: lastRun.hoursAgo };
  }
  
  // Warning: No run in 26+ hours
  if (lastRun.hoursAgo > MAX_AGE_HOURS) {
    console.log('🟡 WARNING: News fetcher may be stuck');
    return { healthy: false, reason: 'stale', hoursAgo: lastRun.hoursAgo };
  }
  
  // Healthy
  console.log('✅ News fetcher healthy');
  return { healthy: true, hoursAgo: lastRun.hoursAgo };
}

// Run watchdog
const result = checkHealth();

if (!result.healthy) {
  if (result.reason === 'critical_no_run') {
    console.log('\n🚨 Critical alert sent');
    process.exit(1);
  } else if (result.reason === 'stale') {
    console.log('\n⚠️  Stale - may need investigation');
    process.exit(1);
  } else {
    console.log('\n❌ Unhealthy');
    process.exit(1);
  }
}

process.exit(0);
