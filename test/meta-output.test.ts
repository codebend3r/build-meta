import { afterAll, describe, expect, it } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';

import { cleanup, git, jsPath, makeProject, readMetaJs, run, writePkg } from './helpers';

afterAll(cleanup);

// The values themselves, read back from the artifact a plain run produces.
// The shape of each output is js-output.test.ts's and json-output.test.ts's
// business; this file only cares that the numbers and strings are right.
describe('meta contents', () => {
  it('takes version from the package.json in the working directory', () => {
    const dir = makeProject({ pkg: { name: 'fixture', version: '4.5.6-beta.1' } });

    run(dir, ['--src-folder', 'src']);

    expect(readMetaJs(dir).version).toBe('4.5.6-beta.1');
  });

  // The CLI resolves package.json from the current working directory, so a
  // package nested inside a larger repo reports its own version while the git
  // fields still come from the enclosing repository.
  it('prefers the nested package.json over the one at the git root', () => {
    const dir = makeProject({ pkg: { name: 'root', version: '1.0.0' } });
    const nested = path.join(dir, 'packages', 'app');
    writePkg(nested, { name: 'app', version: '9.9.9' });
    fs.mkdirSync(path.join(nested, 'src'));

    const result = run(nested, ['--src-folder', 'src']);

    expect(result.status).toBe(0);
    const meta = readMetaJs(nested);
    expect(meta.version).toBe('9.9.9');
    expect(meta.lastCommitHash).toBe(git(dir, ['rev-parse', 'HEAD']));
    expect(fs.existsSync(jsPath(dir))).toBe(false);
  });

  it('omits version when the package.json has none', () => {
    const dir = makeProject({ pkg: { name: 'fixture' } });

    const result = run(dir, ['--src-folder', 'src']);

    expect(result.status).toBe(0);
    expect('version' in readMetaJs(dir)).toBe(false);
  });

  it('records the checked out branch, slashes and all', () => {
    const dir = makeProject({ branch: 'release/4.x' });

    run(dir, ['--src-folder', 'src']);

    expect(readMetaJs(dir).branchName).toBe('release/4.x');
  });

  // What CI usually produces: a bare commit checkout, where the branch name
  // git reports is the literal string HEAD.
  it('records HEAD when the repository is detached', () => {
    const dir = makeProject();
    git(dir, ['checkout', '-q', '--detach']);

    run(dir, ['--src-folder', 'src']);

    expect(readMetaJs(dir).branchName).toBe('HEAD');
  });

  it('takes the branch from the CI environment when detached', () => {
    const dir = makeProject();
    git(dir, ['checkout', '-q', '--detach']);

    run(dir, ['--src-folder', 'src'], { GITHUB_REF_NAME: 'feature/ci' });

    expect(readMetaJs(dir).branchName).toBe('feature/ci');
  });

  // On a pull_request event GITHUB_REF_NAME is "<number>/merge", so the head
  // ref has to win when both are set.
  it('prefers GITHUB_HEAD_REF over GITHUB_REF_NAME', () => {
    const dir = makeProject();
    git(dir, ['checkout', '-q', '--detach']);

    run(dir, ['--src-folder', 'src'], {
      GITHUB_HEAD_REF: 'feature/pr',
      GITHUB_REF_NAME: '12/merge',
    });

    expect(readMetaJs(dir).branchName).toBe('feature/pr');
  });

  it('ignores the CI environment when a branch is checked out', () => {
    const dir = makeProject({ branch: 'main' });

    run(dir, ['--src-folder', 'src'], { GITHUB_REF_NAME: 'something-else' });

    expect(readMetaJs(dir).branchName).toBe('main');
  });

  it('records the author and full hash of the last commit', () => {
    const dir = makeProject({ author: 'Ada Lovelace' });
    git(dir, ['commit', '-q', '--allow-empty', '-m', 'second commit']);

    run(dir, ['--src-folder', 'src']);

    const meta = readMetaJs(dir);
    expect(meta.lastCommitAuthor).toBe('Ada Lovelace');
    expect(meta.lastCommitHash).toBe(git(dir, ['rev-parse', 'HEAD']));
    expect(meta.lastCommitHash).toMatch(/^[0-9a-f]{40}$/u);
  });

  // Committed with a fixed committer date in a non-UTC offset, to prove the
  // value is the commit's own time and that it comes back normalised to UTC.
  it('records the last commit date in UTC', () => {
    const dir = makeProject();
    git(dir, ['commit', '-q', '--allow-empty', '-m', 'dated commit'], {
      GIT_COMMITTER_DATE: '2024-03-10T09:30:00-05:00',
    });

    run(dir, ['--src-folder', 'src']);

    expect(readMetaJs(dir).lastCommitDateISO).toBe('2024-03-10T14:30:00.000Z');
  });

  it('is not dirty on a clean checkout', () => {
    const dir = makeProject();

    run(dir, ['--src-folder', 'src']);

    expect(readMetaJs(dir).dirty).toBe(false);
  });

  it('is dirty when a tracked file has uncommitted changes', () => {
    const dir = makeProject();
    writePkg(dir, { name: 'fixture', version: '1.2.4' });

    run(dir, ['--src-folder', 'src']);

    const meta = readMetaJs(dir);
    expect(meta.dirty).toBe(true);
    expect(meta.describe).toEndWith('-dirty');
  });

  // Untracked files are left out, so dirty agrees with describe's suffix.
  it('is not dirty for untracked files alone', () => {
    const dir = makeProject();
    fs.writeFileSync(path.join(dir, 'scratch.txt'), 'untracked\n');

    run(dir, ['--src-folder', 'src']);

    const meta = readMetaJs(dir);
    expect(meta.dirty).toBe(false);
    expect(meta.describe).not.toEndWith('-dirty');
  });

  it('describes the commit relative to the nearest tag', () => {
    const dir = makeProject();
    git(dir, ['tag', 'v1.0.0']);
    git(dir, ['commit', '-q', '--allow-empty', '-m', 'after the tag']);

    run(dir, ['--src-folder', 'src']);

    const meta = readMetaJs(dir);
    expect(meta.describe).toMatch(/^v1\.0\.0-1-g[0-9a-f]{7,}$/u);
    expect(meta.lastCommitHash.startsWith(meta.describe.split('-g')[1])).toBe(true);
  });

  it('describes with the abbreviated hash when there are no tags', () => {
    const dir = makeProject();

    run(dir, ['--src-folder', 'src']);

    const meta = readMetaJs(dir);
    expect(meta.describe).toMatch(/^[0-9a-f]{7,}$/u);
    expect(meta.lastCommitHash.startsWith(meta.describe)).toBe(true);
  });

  // The CLI hands the object to console.info, so the quoting is the runtime's
  // to choose: bun renders string values with double quotes where node uses
  // single ones. Both are accepted, the assertion is about the values.
  //
  // Strings are quoted and the one boolean, `dirty`, is printed bare.
  it('prints the same object to stdout and leaves stderr empty', () => {
    const dir = makeProject();

    const result = run(dir, ['--src-folder', 'src']);

    expect(result.stderr).toBe('');
    const meta = readMetaJs(dir);
    for (const [key, value] of Object.entries(meta) as [string, string | boolean][]) {
      const printed =
        typeof value === 'boolean'
          ? String(value)
          : `['"]${value.replaceAll(/[.*+?^${}()|[\]\\/]/gu, String.raw`\$&`)}['"]`;
      expect(result.stdout).toMatch(new RegExp(`${key}: ${printed}`, 'u'));
    }
  });
});
