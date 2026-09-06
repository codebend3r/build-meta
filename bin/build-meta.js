#!/usr/bin/env node

// Writes a meta.json describing the current build. Every path here resolves
// against the current working directory, so this must run from the directory
// that holds the consuming project's package.json, not from the git root and
// not from build-meta's own install location.
//
// Stdlib only. Adding a runtime dependency is a deliberate regression: the
// whole point of the rewrite was to drop the eight packages 0.0.12 shipped.

const { execSync } = require('child_process');
const { writeFileSync } = require('fs');
const path = require('path');
const { parseArgs } = require('util');

// parseArgs is strict by default, which is what we want: an unknown flag or a
// stray positional throws instead of being silently ignored. That means there
// is no `build-meta src` shorthand, the flag is mandatory.
const { values: flags } = parseArgs({
  options: {
    'src-folder': { type: 'string' },
    env: { type: 'string' },
  },
});

// The only failure we bother to report nicely. Everything below surfaces as an
// uncaught exception, which still exits non-zero and keeps a broken build from
// shipping stale metadata.
if (!flags['src-folder']) {
  console.error('build-meta: --src-folder <dir> is required');
  process.exit(1);
}

// execSync throws on a non-zero exit, so a missing git or a non-repo directory
// aborts the run. stderr is inherited rather than piped so git's own message
// ("fatal: not a git repository") reaches the terminal instead of being
// swallowed into the exception.
const git = (args) =>
  execSync(`git ${args}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();

// Formatted via formatToParts because no single Intl preset produces
// "MM-DD-YYYY hh:mm:ss AM ET". Eastern Time is hardcoded on purpose: the point
// is that every build stamp is comparable regardless of which machine or CI
// region produced it.
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
  // Throws if the working directory has no package.json, which is the intended
  // signal that build-meta was invoked from the wrong place.
  version: require(path.resolve('package.json')).version,
  buildDate: buildDate(),
  // An explicit --env wins, then the two env vars, then a literal default.
  // Note an empty --env='' falls through to the same chain.
  buildEnv: flags.env || process.env.NODE_ENV || process.env.PROFILE || 'development',
  // Yields the literal string "HEAD" on a detached checkout. Most CI providers
  // check out a bare commit, so expect "HEAD" there unless the job checks out
  // a branch explicitly.
  branchName: git('rev-parse --abbrev-ref HEAD'),
  lastCommitAuthor: git('log -1 --format=%an'),
  lastCommitHash: git('rev-parse HEAD'),
};

// The write comes last, after the git calls have already run, so a bad
// --src-folder fails at the very end with an ENOENT. The directory must
// already exist; this deliberately does not create it.
writeFileSync(path.resolve(flags['src-folder'], 'meta.json'), JSON.stringify(meta, null, 2) + '\n');

console.info(meta);
