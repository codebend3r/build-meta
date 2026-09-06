// Fixtures for the CLI tests. Everything here builds a throwaway project on
// disk and runs bin/build-meta.js against it in a child process: the CLI does
// all its work at module load, so there is nothing to import and assert on.
// That file is the compiled output, so `bun run build` has to have run first.
//
// node:child_process and node:fs are used rather than the Bun globals because
// the same fixtures have to keep working if the suite is ever run under node.

import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// The keys the CLI writes, all string valued. `version` is optional because a
// package.json without one leaves it undefined and JSON.stringify drops it.
export type Meta = {
  version?: string;
  buildDate: string;
  buildEnv: string;
  branchName: string;
  lastCommitAuthor: string;
  lastCommitHash: string;
};

// Only the fields the fixtures set. A fixture package.json is otherwise free
// to carry whatever the test needs.
export type FixturePkg = Record<string, unknown>;

export type ProjectOptions = {
  pkg?: FixturePkg | null;
  branch?: string;
  author?: string;
  srcFolder?: string | null;
};

export const CLI = path.resolve(__dirname, '..', 'bin', 'build-meta.js');

// Real path, because git ignores a GIT_CEILING_DIRECTORIES entry that is a
// symlink and /var is one on macOS.
export const TMP_ROOT = fs.realpathSync(os.tmpdir());

const fixtures: string[] = [];

// Git reads config from the fixture repo only. Without this a developer's
// global user.name, commit.gpgsign or init.templateDir would leak into the
// commits the assertions check.
const GIT_ENV = {
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null',
  GIT_TERMINAL_PROMPT: '0',
};

// Git exports GIT_AUTHOR_NAME, GIT_AUTHOR_DATE, GIT_INDEX_FILE and friends to
// every hook it runs, and the `pre-commit` hook runs this suite. Inheriting
// them would author the fixture commits as whoever is committing and point the
// fixtures at the outer index, so every GIT_* variable is dropped and only the
// ones the fixtures set themselves are put back.
function cleanEnv(extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const inherited = Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'));
  return { ...Object.fromEntries(inherited), ...GIT_ENV, ...extra };
}

export function git(cwd: string, args: string[]): string {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: cleanEnv(),
  });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed in ${cwd}\n${result.stderr}`);
  }
  return result.stdout.trim();
}

export function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(TMP_ROOT, 'build-meta-'));
  fixtures.push(dir);
  return dir;
}

// A project the CLI is happy to run in: a package.json, a git repo with one
// commit, and an existing folder to receive meta.json. Pass pkg: null or
// srcFolder: null to leave one of those out.
export function makeProject({
  pkg = { name: 'fixture', version: '1.2.3' },
  branch = 'main',
  author = 'Fixture Author',
  srcFolder = 'src',
}: ProjectOptions = {}): string {
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

export function writePkg(dir: string, pkg: FixturePkg): void {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
}

// NODE_ENV and PROFILE are stripped so the buildEnv fallback chain starts from
// a known state no matter what the test runner was launched with.
//
// process.execPath is the bun binary under `bun test`, so this exercises the
// CLI on the runtime the repo now develops against. The compiled file is
// stdlib-only CJS, so bun and node both run it unchanged.
export function run(
  cwd: string,
  args: string[] = [],
  env: NodeJS.ProcessEnv = {},
): SpawnSyncReturns<string> {
  const base = cleanEnv({ GIT_CEILING_DIRECTORIES: TMP_ROOT });
  delete base.NODE_ENV;
  delete base.PROFILE;
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...base, ...env },
  });
}

export function metaPath(dir: string, srcFolder = 'src'): string {
  return path.join(dir, srcFolder, 'meta.json');
}

export function readMeta(dir: string, srcFolder = 'src'): Meta {
  return JSON.parse(fs.readFileSync(metaPath(dir, srcFolder), 'utf8')) as Meta;
}

// Built from toLocaleString rather than formatToParts so the expectation is an
// independent formatting of the same instant, not a copy of the CLI's code.
// ICU puts a narrow no-break space before AM/PM, hence the loose split.
export function torontoStamp(date: Date): string {
  const [day, time, meridiem] = date
    .toLocaleString('en-US', {
      timeZone: 'America/Toronto',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    })
    .split(/[\s ]+/u);
  return `${day.replace(',', '').replaceAll('/', '-')} ${time} ${meridiem} ET`;
}

// Every stamp the CLI could legitimately have produced while the child process
// was alive, so the assertion stays exact without depending on how long the
// run took.
export function torontoStampsBetween(startMs: number, endMs: number): Set<string> {
  const stamps = new Set<string>();
  for (let t = Math.floor(startMs / 1000) * 1000; t <= endMs + 1000; t += 1000) {
    stamps.add(torontoStamp(new Date(t)));
  }
  return stamps;
}

export function cleanup(): void {
  for (const dir of fixtures.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
