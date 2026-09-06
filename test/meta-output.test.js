'use strict';

const { afterAll, describe, expect, it } = require('bun:test');
const fs = require('node:fs');
const path = require('node:path');

const { cleanup, git, makeProject, metaPath, readMeta, run, writePkg } = require('./helpers');

afterAll(cleanup);

describe('meta.json contents', () => {
  it('writes the six documented keys in order', () => {
    const dir = makeProject();

    const result = run(dir, ['--src-folder', 'src']);

    expect(result.status).toBe(0);
    expect(Object.keys(readMeta(dir))).toEqual([
      'version',
      'buildDate',
      'buildEnv',
      'branchName',
      'lastCommitAuthor',
      'lastCommitHash',
    ]);
  });

  it('takes version from the package.json in the working directory', () => {
    const dir = makeProject({ pkg: { name: 'fixture', version: '4.5.6-beta.1' } });

    run(dir, ['--src-folder', 'src']);

    expect(readMeta(dir).version).toBe('4.5.6-beta.1');
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
    const meta = readMeta(nested);
    expect(meta.version).toBe('9.9.9');
    expect(meta.lastCommitHash).toBe(git(dir, ['rev-parse', 'HEAD']));
    expect(fs.existsSync(metaPath(dir))).toBe(false);
  });

  it('omits version when the package.json has none', () => {
    const dir = makeProject({ pkg: { name: 'fixture' } });

    const result = run(dir, ['--src-folder', 'src']);

    expect(result.status).toBe(0);
    expect('version' in readMeta(dir)).toBe(false);
  });

  it('records the checked out branch, slashes and all', () => {
    const dir = makeProject({ branch: 'release/4.x' });

    run(dir, ['--src-folder', 'src']);

    expect(readMeta(dir).branchName).toBe('release/4.x');
  });

  // What CI usually produces: a bare commit checkout, where the branch name
  // git reports is the literal string HEAD.
  it('records HEAD when the repository is detached', () => {
    const dir = makeProject();
    git(dir, ['checkout', '-q', '--detach']);

    run(dir, ['--src-folder', 'src']);

    expect(readMeta(dir).branchName).toBe('HEAD');
  });

  it('records the author and full hash of the last commit', () => {
    const dir = makeProject({ author: 'Ada Lovelace' });
    git(dir, ['commit', '-q', '--allow-empty', '-m', 'second commit']);

    run(dir, ['--src-folder', 'src']);

    const meta = readMeta(dir);
    expect(meta.lastCommitAuthor).toBe('Ada Lovelace');
    expect(meta.lastCommitHash).toBe(git(dir, ['rev-parse', 'HEAD']));
    expect(meta.lastCommitHash).toMatch(/^[0-9a-f]{40}$/);
  });

  it('formats the file with two-space indentation and a trailing newline', () => {
    const dir = makeProject();

    run(dir, ['--src-folder', 'src']);

    const contents = fs.readFileSync(metaPath(dir), 'utf8');
    expect(contents).toMatch(/^\{\n  "version": "1\.2\.3",\n/);
    expect(contents.endsWith('}\n')).toBe(true);
  });

  // The CLI hands the object to console.info, so the quoting is the runtime's
  // to choose: bun renders string values with double quotes where node uses
  // single ones. Both are accepted, the assertion is about the values.
  it('prints the same object to stdout and leaves stderr empty', () => {
    const dir = makeProject();

    const result = run(dir, ['--src-folder', 'src']);

    expect(result.stderr).toBe('');
    const meta = readMeta(dir);
    for (const [key, value] of Object.entries(meta)) {
      expect(result.stdout).toMatch(
        new RegExp(`${key}: ['"]${value.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}['"]`),
      );
    }
  });
});
