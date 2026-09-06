#!/usr/bin/env node

// Writes a meta.js describing the current build, and a meta.json alongside it
// when asked. Every path here resolves against the current working directory,
// so this must run from the directory that holds the consuming project's
// package.json, not from the git root and not from build-meta's own install
// location.
//
// Stdlib only. Adding a runtime dependency is a deliberate regression: the
// whole point of the rewrite was to drop the eight packages 0.0.12 shipped.
//
// This is the TypeScript source; `bun run build` compiles it down to the
// stdlib-only CommonJS `bin/build-meta.js` that actually ships, so consumers
// still need nothing but node and git.

import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

// The shape build-meta cares about. Everything else in a package.json is
// irrelevant here, and `version` is optional because a package.json without
// one is a case the CLI handles rather than rejects.
type PackageJson = { version?: string };

type Meta = {
  version: string | undefined;
  buildDate: string;
  buildDateISO: string;
  buildEnv: string;
  branchName: string;
  lastCommitAuthor: string;
  lastCommitHash: string;
};

// The property meta.js installs on the global. It is not a valid identifier,
// so it is only ever reachable as window['build-meta'], never window.build-meta.
const GLOBAL_KEY = 'build-meta';

// parseArgs is strict by default, which is what we want: an unknown flag or a
// stray positional throws instead of being silently ignored. That means there
// is no `build-meta src` shorthand, the flag is mandatory.
const { values: flags } = parseArgs({
  options: {
    'src-folder': { type: 'string' },
    env: { type: 'string' },
    'output-json': { type: 'boolean' },
    'json-out-dir': { type: 'string' },
  },
});

// The only failure we bother to report nicely. Everything below surfaces as an
// uncaught exception, which still exits non-zero and keeps a broken build from
// shipping stale metadata.
if (!flags['src-folder']) {
  console.error('build-meta: --src-folder <dir> is required');
  process.exit(1);
}

// Naming a directory for the JSON is itself the request for it, so
// --json-out-dir alone is enough and there is no need to pass both flags. With
// no directory the file lands in the working directory, the same place the
// package.json was read from, and never at the git root.
const jsonOutDir = flags['json-out-dir'];
const wantsJson = Boolean(flags['output-json']) || jsonOutDir !== undefined;

// execSync throws on a non-zero exit, so a missing git or a non-repo directory
// aborts the run. stderr is inherited rather than piped so git's own message
// ("fatal: not a git repository") reaches the terminal instead of being
// swallowed into the exception.
const git = (args: string): string =>
  execSync(`git ${args}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();

// Formatted via formatToParts because no single Intl preset produces
// "MM-DD-YYYY hh:mm:ss AM ET". Eastern Time is hardcoded on purpose: the point
// is that every build stamp is comparable regardless of which machine or CI
// region produced it.
function buildDate(at: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).formatToParts(at);
  const p = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${p.month}-${p.day}-${p.year} ${p.hour}:${p.minute}:${p.second} ${p.dayPeriod} ET`;
}

// One instant for both stamps, so buildDate and buildDateISO can never
// disagree by a second when the run straddles a tick.
const now = new Date();

const meta: Meta = {
  // Throws if the working directory has no package.json, which is the intended
  // signal that build-meta was invoked from the wrong place. A package.json
  // with no version leaves this undefined, which JSON.stringify then drops.
  version: (require(resolve('package.json')) as PackageJson).version,
  buildDate: buildDate(now),
  // The machine readable half of the pair: UTC, always suffixed Z, and safe to
  // hand to Date.parse. buildDate above stays the human readable one.
  buildDateISO: now.toISOString(),
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

// Serialized once. The script and the JSON file are two spellings of the same
// in memory object, so the two outputs cannot drift apart.
const json = JSON.stringify(meta, null, 2);

// A plain script, not a module, so it works from a <script src> tag and from a
// side effect `import './meta.js'` alike. The IIFE keeps its one local out of
// the page's global scope, the globalThis fallback keeps it from throwing where
// there is no window at all, and the `||` leaves an existing value alone, which
// is the behaviour the boilerplate this replaces had to spell out by hand.
const script = `(function () {
  var g = typeof window !== 'undefined' ? window : globalThis;
  g[${JSON.stringify(GLOBAL_KEY)}] = g[${JSON.stringify(GLOBAL_KEY)}] || ${json.replaceAll('\n', '\n  ')};
})();
`;

// The writes come last, after the git calls have already run, so a bad
// --src-folder fails at the very end with an ENOENT. Directories must already
// exist; this deliberately does not create them.
writeFileSync(resolve(flags['src-folder'], 'meta.js'), script);

if (wantsJson) {
  writeFileSync(resolve(jsonOutDir ?? '.', 'meta.json'), json + '\n');
}

console.info(meta);
