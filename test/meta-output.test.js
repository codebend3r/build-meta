'use strict';

const { after, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { cleanup, git, makeProject, metaPath, readMeta, run, writePkg } = require('./helpers');

after(cleanup);

describe('meta.json contents', () => {
  it('writes the six documented keys in order', () => {
    const dir = makeProject();

    const result = run(dir, ['--src-folder', 'src']);

    assert.equal(result.status, 0);
    assert.deepEqual(Object.keys(readMeta(dir)), [
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

    assert.equal(readMeta(dir).version, '4.5.6-beta.1');
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

    assert.equal(result.status, 0);
    const meta = readMeta(nested);
    assert.equal(meta.version, '9.9.9');
    assert.equal(meta.lastCommitHash, git(dir, ['rev-parse', 'HEAD']));
    assert.equal(fs.existsSync(metaPath(dir)), false);
  });

  it('omits version when the package.json has none', () => {
    const dir = makeProject({ pkg: { name: 'fixture' } });

    const result = run(dir, ['--src-folder', 'src']);

    assert.equal(result.status, 0);
    assert.equal('version' in readMeta(dir), false);
  });

  it('records the checked out branch, slashes and all', () => {
    const dir = makeProject({ branch: 'release/4.x' });

    run(dir, ['--src-folder', 'src']);

    assert.equal(readMeta(dir).branchName, 'release/4.x');
  });

  // What CI usually produces: a bare commit checkout, where the branch name
  // git reports is the literal string HEAD.
  it('records HEAD when the repository is detached', () => {
    const dir = makeProject();
    git(dir, ['checkout', '-q', '--detach']);

    run(dir, ['--src-folder', 'src']);

    assert.equal(readMeta(dir).branchName, 'HEAD');
  });

  it('records the author and full hash of the last commit', () => {
    const dir = makeProject({ author: 'Ada Lovelace' });
    git(dir, ['commit', '-q', '--allow-empty', '-m', 'second commit']);

    run(dir, ['--src-folder', 'src']);

    const meta = readMeta(dir);
    assert.equal(meta.lastCommitAuthor, 'Ada Lovelace');
    assert.equal(meta.lastCommitHash, git(dir, ['rev-parse', 'HEAD']));
    assert.match(meta.lastCommitHash, /^[0-9a-f]{40}$/);
  });

  it('formats the file with two-space indentation and a trailing newline', () => {
    const dir = makeProject();

    run(dir, ['--src-folder', 'src']);

    const contents = fs.readFileSync(metaPath(dir), 'utf8');
    assert.match(contents, /^\{\n  "version": "1\.2\.3",\n/);
    assert.equal(contents.endsWith('}\n'), true);
  });

  it('prints the same object to stdout and leaves stderr empty', () => {
    const dir = makeProject();

    const result = run(dir, ['--src-folder', 'src']);

    assert.equal(result.stderr, '');
    const meta = readMeta(dir);
    for (const [key, value] of Object.entries(meta)) {
      assert.match(result.stdout, new RegExp(`${key}: '${value.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}'`));
    }
  });
});
