#!/usr/bin/env node
const { execSync } = require('child_process');
const { writeFileSync } = require('fs');
const path = require('path');
const { parseArgs } = require('util');

const { values: flags } = parseArgs({
  options: {
    'src-folder': { type: 'string' },
    env: { type: 'string' },
  },
});

if (!flags['src-folder']) {
  console.error('build-meta: --src-folder <dir> is required');
  process.exit(1);
}

const git = (args) =>
  execSync(`git ${args}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();

function buildDate() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Toronto',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
  }).formatToParts(new Date());
  const p = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${p.month}-${p.day}-${p.year} ${p.hour}:${p.minute}:${p.second} ${p.dayPeriod} ET`;
}

const meta = {
  version: require(path.resolve('package.json')).version,
  buildDate: buildDate(),
  buildEnv: flags.env || process.env.NODE_ENV || process.env.PROFILE || 'development',
  branchName: git('rev-parse --abbrev-ref HEAD'),
  lastCommitAuthor: git('log -1 --format=%an'),
  lastCommitHash: git('rev-parse HEAD'),
};

writeFileSync(path.resolve(flags['src-folder'], 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
console.info(meta);
