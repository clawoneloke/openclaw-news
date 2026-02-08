#!/usr/bin/env node

/**
 * GitHub Upload Script for OpenClaw Projects
 * Uploads a project directory to GitHub as a repository
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const PROJECT_DIR = process.argv[2] || path.join(process.env.HOME, '.openclaw/workspace/news');
const REPO_NAME = process.argv[3] || 'openclaw-news';

// Try multiple sources for GitHub token
let GITHUB_TOKEN = process.env.GITHUB_TOKEN;

const WORKSPACE_TOKEN = path.join(process.env.HOME, '.openclaw', 'workspace', 'github-token');
if (!GITHUB_TOKEN && fs.existsSync(WORKSPACE_TOKEN)) {
  GITHUB_TOKEN = fs.readFileSync(WORKSPACE_TOKEN, 'utf8').trim();
}

const TOKEN_FILE = path.join(process.env.HOME, '.config', 'github-token');
if (!GITHUB_TOKEN && fs.existsSync(TOKEN_FILE)) {
  GITHUB_TOKEN = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
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
 * Check GitHub token
 */
function checkToken() {
  if (!GITHUB_TOKEN) {
    console.log(`${colors.red}Error: GITHUB_TOKEN not set${colors.reset}`);
    console.log(`${colors.cyan}Set via: export GITHUB_TOKEN="token"${colors.reset}`);
    console.log(`${colors.cyan}Or save to: ~/workspace/github-token${colors.reset}`);
    process.exit(1);
  }
  console.log(`${colors.green}✓ GitHub token configured${colors.reset}`);
}

/**
 * Get GitHub username
 */
function getGitHubUsername() {
  try {
    const response = execSync(`curl -s -H "Authorization: token ${GITHUB_TOKEN}" https://api.github.com/user`, { encoding: 'utf8' });
    const data = JSON.parse(response);
    return data.login;
  } catch (error) {
    throw new Error('Failed to get GitHub username: ' + error.message);
  }
}

/**
 * Check if repo exists
 */
function repoExists(username, repoName) {
  try {
    const response = execSync(
      `curl -s -o /dev/null -w "%{http_code}" -H "Authorization: token ${GITHUB_TOKEN}" https://api.github.com/repos/${username}/${repoName}`,
      { encoding: 'utf8' }
    );
    return response === '200';
  } catch {
    return false;
  }
}

/**
 * Create repository
 */
function createRepo(username, repoName) {
  console.log(`${colors.cyan}Creating repository: ${repoName}${colors.reset}`);
  
  try {
    execSync(`curl -X POST -H "Authorization: token ${GITHUB_TOKEN}" \
      -d '{"name":"${repoName}","description":"Daily news fetcher for OpenClaw","private":false}' \
      https://api.github.com/user/repos`, { encoding: 'utf8' });
    
    console.log(`${colors.green}✓ Repository created${colors.reset}`);
    return true;
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log(`${colors.yellow}Repository already exists${colors.reset}`);
      return true;
    }
    throw error;
  }
}

/**
 * Initialize git and push
 */
function uploadToGitHub(projectDir, repoName) {
  console.log(`${colors.cyan}Initializing git repository...${colors.reset}`);
  
  const repoDir = `/tmp/${repoName}`;
  
  // Clean up temp dir
  execSync(`rm -rf ${repoDir}`);
  execSync(`mkdir -p ${repoDir}`);
  
  // Copy files
  execSync(`cp -r ${projectDir}/* ${repoDir}/`);
  
  // Initialize git
  execSync(`cd ${repoDir} && git init`);
  execSync(`cd ${repoDir} && git add .`);
  execSync(`cd ${repoDir} && git commit -m "Initial upload of ${repoName}"`);
  
  // Add remote
  execSync(`cd ${repoDir} && git remote add origin https://github.com/clawoneloke/${repoName}.git`);
  
  // Push
  console.log(`${colors.cyan}Pushing to GitHub...${colors.reset}`);
  try {
    execSync(`cd ${repoDir} && git branch -M main && git push -u origin main`);
    console.log(`${colors.green}✓ Successfully pushed to GitHub${colors.reset}`);
  } catch (error) {
    console.log(`${colors.yellow}Retrying with token authentication...${colors.reset}`);
    execSync(`cd ${repoDir} && git remote set-url origin https://${GITHUB_TOKEN}@github.com/clawoneloke/${repoName}.git`);
    execSync(`cd ${repoDir} && git push -u origin main`);
    console.log(`${colors.green}✓ Successfully pushed to GitHub${colors.reset}`);
  }
  
  // Cleanup
  execSync(`rm -rf ${repoDir}`);
}

/**
 * List files in project directory
 */
function listFiles(dir) {
  const files = [];
  
  function scan(directory, prefix = '') {
    const items = fs.readdirSync(directory);
    
    for (const item of items) {
      const fullPath = path.join(directory, item);
      const relativePath = prefix + item;
      
      // Skip node_modules
      if (item === 'node_modules') return;
      
      if (fs.statSync(fullPath).isDirectory()) {
        files.push({ type: 'dir', name: relativePath });
        scan(fullPath, relativePath + '/');
      } else {
        files.push({ type: 'file', name: relativePath });
      }
    }
  }
  
  scan(dir);
  return files;
}

/**
 * Main
 */
function main() {
  console.log(`${colors.green}${colors.bold}GitHub Upload Script for OpenClaw${colors.reset}\n`);
  
  // Check token
  checkToken();
  
  // Get username
  const username = getGitHubUsername();
  console.log(`${colors.green}✓ GitHub username: ${username}${colors.reset}`);
  
  // Check project directory
  if (!fs.existsSync(PROJECT_DIR)) {
    console.log(`${colors.red}Error: Project directory not found: ${PROJECT_DIR}${colors.reset}`);
    process.exit(1);
  }
  
  // List files
  console.log(`${colors.cyan}Files to upload:${colors.reset}`);
  const files = listFiles(PROJECT_DIR);
  files.forEach(f => {
    console.log(`  ${f.type === 'dir' ? '📁' : '📄'} ${f.name}`);
  });
  console.log('');
  
  // Create repo
  createRepo(username, REPO_NAME);
  
  // Upload
  uploadToGitHub(PROJECT_DIR, REPO_NAME);
  
  console.log(`\n${colors.green}${colors.bold}✓ Upload complete!${colors.reset}`);
  console.log(`${colors.cyan}Repository: https://github.com/${username}/${REPO_NAME}${colors.reset}`);
}

// Run
main();
