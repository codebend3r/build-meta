'use strict';

// Fixtures for the CLI tests. Everything here builds a throwaway project on
// disk and runs bin/build-meta.js against it in a child process: the CLI does
// all its work at module load, so there is nothing to require() and assert on.
//
// node:child_process and node:fs are used rather than the Bun globals because
// the same fixtures have to keep working if the suite is ever run under node.

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CLI = path.resolve(__dirname, '..', 'bin', 'build-meta.js');

// Real path, because git ignores a GIT_CEILING_DIRECTORIES entry that is a
// symlink and /var is one on macOS.
const TMP_ROOT = fs.realpathSync(os.tmpdir());

const fixtures = [];

// Git reads config from the fixture repo only. Without this a developer's
// global user.name, commit.gpgsign or init.templateDir would leak into the
// commits the assertions check.
const GIT_ENV = {
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null',
  GIT_TERMINAL_PROMPT: '0',
};

function git(cwd, args) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...GIT_ENV },
  });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed in ${cwd}\n${result.stderr}`);
  }
  return result.stdout.trim();
}

function tempDir() {
  const dir = fs.mkdtempSync(path.join(TMP_ROOT, 'build-meta-'));
  fixtures.push(dir);
  return dir;
}

// A project the CLI is happy to run in: a package.json, a git repo with one
// commit, and an existing folder to receive meta.json. Pass pkg: null or
// srcFolder: null to leave one of those out.
function makeProject({
  pkg = { name: 'fixture', version: '1.2.3' },
  branch = 'main',
  author = 'Fixture Author',
  srcFolder = 'src',
} = {}) {
  const dir = tempDir();
  if (pkg) writePkg(dir, pkg);
  if (srcFolder) fs.mkdirSync(path.join(dir, srcFolder), { recursive: true });
  git(dir, ['init', '-q', '-b', branch]);
  git(dir, ['config', 'user.name', author]);
  git(dir, ['config', 'user.email', 'fixture@example.com']);
  git(dir, ['config', 'commit.gpgsign', 'false']);
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '--allow-empty', '-m', 'initial commit']);
  return dir;
}

function writePkg(dir, pkg) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
}

// NODE_ENV and PROFILE are stripped so the buildEnv fallback chain starts from
// a known state no matter what the test runner was launched with.
//
// process.execPath is the bun binary under `bun test`, so this exercises the
// CLI on the runtime the repo now develops against. The file is stdlib-only
// CJS, so bun and node both run it unchanged.
function run(cwd, args = [], env = {}) {
  const base = { ...process.env, ...GIT_ENV, GIT_CEILING_DIRECTORIES: TMP_ROOT };
  delete base.NODE_ENV;
  delete base.PROFILE;
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...base, ...env },
  });
}

function metaPath(dir, srcFolder = 'src') {
  return path.join(dir, srcFolder, 'meta.json');
}

function readMeta(dir, srcFolder = 'src') {
  return JSON.parse(fs.readFileSync(metaPath(dir, srcFolder), 'utf8'));
}

// Built from toLocaleString rather than formatToParts so the expectation is an
// independent formatting of the same instant, not a copy of the CLI's code.
// ICU puts a narrow no-break space before AM/PM, hence the loose split.
function torontoStamp(date) {
  const [day, time, meridiem] = date
    .toLocaleString('en-US', {
      timeZone: 'America/Toronto',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
    })
    .split(/[\s ]+/);
  return `${day.replace(',', '').replaceAll('/', '-')} ${time} ${meridiem} ET`;
}

// Every stamp the CLI could legitimately have produced while the child process
// was alive, so the assertion stays exact without depending on how long the
// run took.
function torontoStampsBetween(startMs, endMs) {
  const stamps = new Set();
  for (let t = Math.floor(startMs / 1000) * 1000; t <= endMs + 1000; t += 1000) {
    stamps.add(torontoStamp(new Date(t)));
  }
  return stamps;
}

function cleanup() {
  for (const dir of fixtures.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

module.exports = {
  CLI,
  TMP_ROOT,
  cleanup,
  git,
  makeProject,
  metaPath,
  readMeta,
  run,
  tempDir,
  torontoStamp,
  torontoStampsBetween,
  writePkg,
};
