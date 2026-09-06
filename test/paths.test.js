'use strict';

const { after, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { cleanup, makeProject, metaPath, readMeta, run, tempDir } = require('./helpers');

after(cleanup);

// --src-folder is resolved against the working directory, never the git root.
describe('--src-folder resolution', () => {
  it('accepts a nested relative path', () => {
    const dir = makeProject({ srcFolder: path.join('build', 'dist') });

    const result = run(dir, ['--src-folder', 'build/dist']);

    assert.equal(result.status, 0);
    assert.equal(readMeta(dir, 'build/dist').version, '1.2.3');
  });

  it('accepts . for the working directory itself', () => {
    const dir = makeProject();

    const result = run(dir, ['--src-folder', '.']);

    assert.equal(result.status, 0);
    assert.equal(readMeta(dir, '.').version, '1.2.3');
  });

  it('accepts an absolute path outside the repository', () => {
    const dir = makeProject();
    const outside = tempDir();

    const result = run(dir, ['--src-folder', outside]);

    assert.equal(result.status, 0);
    assert.equal(JSON.parse(fs.readFileSync(path.join(outside, 'meta.json'), 'utf8')).version, '1.2.3');
    assert.equal(fs.existsSync(metaPath(dir)), false);
  });

  it('resolves a relative path against the working directory, not the git root', () => {
    const dir = makeProject();
    const nested = path.join(dir, 'packages', 'app');
    fs.mkdirSync(path.join(nested, 'src'), { recursive: true });
    fs.writeFileSync(path.join(nested, 'package.json'), '{"name":"app","version":"2.0.0"}\n');

    run(nested, ['--src-folder', 'src']);

    assert.equal(fs.existsSync(path.join(nested, 'src', 'meta.json')), true);
    assert.equal(fs.existsSync(metaPath(dir)), false);
  });

  it('overwrites an existing meta.json', () => {
    const dir = makeProject();
    fs.writeFileSync(metaPath(dir), '{"version":"stale"}\n');

    run(dir, ['--src-folder', 'src']);

    assert.equal(readMeta(dir).version, '1.2.3');
  });
});
