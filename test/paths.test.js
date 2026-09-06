'use strict';

const { afterAll, describe, expect, it } = require('bun:test');
const fs = require('node:fs');
const path = require('node:path');

const { cleanup, makeProject, metaPath, readMeta, run, tempDir } = require('./helpers');

afterAll(cleanup);

// --src-folder is resolved against the working directory, never the git root.
describe('--src-folder resolution', () => {
  it('accepts a nested relative path', () => {
    const dir = makeProject({ srcFolder: path.join('build', 'dist') });

    const result = run(dir, ['--src-folder', 'build/dist']);

    expect(result.status).toBe(0);
    expect(readMeta(dir, 'build/dist').version).toBe('1.2.3');
  });

  it('accepts . for the working directory itself', () => {
    const dir = makeProject();

    const result = run(dir, ['--src-folder', '.']);

    expect(result.status).toBe(0);
    expect(readMeta(dir, '.').version).toBe('1.2.3');
  });

  it('accepts an absolute path outside the repository', () => {
    const dir = makeProject();
    const outside = tempDir();

    const result = run(dir, ['--src-folder', outside]);

    expect(result.status).toBe(0);
    expect(JSON.parse(fs.readFileSync(path.join(outside, 'meta.json'), 'utf8')).version).toBe(
      '1.2.3',
    );
    expect(fs.existsSync(metaPath(dir))).toBe(false);
  });

  it('resolves a relative path against the working directory, not the git root', () => {
    const dir = makeProject();
    const nested = path.join(dir, 'packages', 'app');
    fs.mkdirSync(path.join(nested, 'src'), { recursive: true });
    fs.writeFileSync(path.join(nested, 'package.json'), '{"name":"app","version":"2.0.0"}\n');

    run(nested, ['--src-folder', 'src']);

    expect(fs.existsSync(path.join(nested, 'src', 'meta.json'))).toBe(true);
    expect(fs.existsSync(metaPath(dir))).toBe(false);
  });

  it('overwrites an existing meta.json', () => {
    const dir = makeProject();
    fs.writeFileSync(metaPath(dir), '{"version":"stale"}\n');

    run(dir, ['--src-folder', 'src']);

    expect(readMeta(dir).version).toBe('1.2.3');
  });
});
