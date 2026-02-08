#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const PROJECT_DIR = process.argv[2] || path.join(process.env.HOME, '.openclaw/workspace/news');
const REPO_NAME = 'openclaw-news';

const colors = {
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  reset: '\x1b[0m'
};

const GITHUB_TOKEN = fs.readFileSync(path.join(process.env.HOME, '.openclaw/workspace/github-token'), 'utf8').trim();

console.log(colors.green + '✓ GitHub token loaded' + colors.reset);

// Get username
const curlUser = spawnSync('curl', ['-s', '-H', 'Authorization: token ' + GITHUB_TOKEN, 'https://api.github.com/user'], { encoding: 'utf8' });
const userData = JSON.parse(curlUser.stdout);
console.log(colors.green + '✓ Username: ' + userData.login + colors.reset);

// Create repo
spawnSync('curl', ['-X', 'POST', '-H', 'Authorization: token ' + GITHUB_TOKEN, '-d', '{"name":"' + REPO_NAME + '","description":"Daily news fetcher for OpenClaw","private":false}', 'https://api.github.com/user/repos'], { encoding: 'utf8' });
console.log(colors.green + '✓ Repository created' + colors.reset);

// Init git
const repoDir = '/tmp/' + REPO_NAME;
execSync('rm -rf ' + repoDir);
execSync('mkdir -p ' + repoDir);
execSync('cp -r ' + PROJECT_DIR + '/* ' + repoDir + '/');
execSync('cd ' + repoDir + ' && git init');
execSync('cd ' + repoDir + ' && git add .');
execSync('cd ' + repoDir + ' && git commit -m "Initial upload of ' + REPO_NAME + '"');

// Create askpass.sh script
const askpassContent = '#!/bin/bash\necho "' + GITHUB_TOKEN + '"';
fs.writeFileSync('/tmp/askpass.sh', askpassContent);
execSync('chmod +x /tmp/askpass.sh');

// Set HOME for git to find the script
const gitEnv = { ...process.env, HOME: '/tmp', GIT_ASKPASS: '/tmp/askpass.sh' };
execSync('cd ' + repoDir + ' && git remote add origin https://github.com/clawoneloke/' + REPO_NAME + '.git', { env: gitEnv });
execSync('cd ' + repoDir + ' && git branch -M main', { env: gitEnv });
execSync('cd ' + repoDir + ' && git push -u origin main', { env: gitEnv });

console.log(colors.green + '✓ Pushed to GitHub: https://github.com/clawoneloke/' + REPO_NAME + colors.reset);

// Cleanup
execSync('rm -rf ' + repoDir);
execSync('rm -f /tmp/askpass.sh');
