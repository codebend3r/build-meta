import { afterAll, describe, expect, it } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';

import {
  cleanup,
  jsPath,
  makeProject,
  type Meta,
  metaPath,
  readMeta,
  readMetaJs,
  run,
  tempDir,
} from './helpers';

afterAll(cleanup);

// meta.json is opt in. --output-json asks for it, --json-out-dir says where it
// goes and implies the request, and the default location is the working
// directory rather than the git root, the same rule --src-folder follows.
describe('--output-json', () => {
  it('writes meta.json in the working directory', () => {
    const dir = makeProject();

    const result = run(dir, ['--src-folder', 'src', '--output-json']);

    expect(result.status).toBe(0);
    expect(readMeta(dir, '.').version).toBe('1.2.3');
  });

  it('still writes meta.js alongside it', () => {
    const dir = makeProject();

    run(dir, ['--src-folder', 'src', '--output-json']);

    expect(readMetaJs(dir).version).toBe('1.2.3');
  });

  it('writes the same values to both outputs', () => {
    const dir = makeProject();

    run(dir, ['--src-folder', 'src', '--output-json']);

    expect(readMeta(dir, '.')).toEqual(readMetaJs(dir));
  });

  it('takes no value', () => {
    const dir = makeProject();

    const result = run(dir, ['--src-folder', 'src', '--output-json=src']);

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/Option '--output-json' does not take an argument/u);
  });

  // The working directory is the package being described, which in a monorepo
  // is the nested package and not the top of the repository.
  it('lands in the working directory, not the git root', () => {
    const dir = makeProject();
    const nested = path.join(dir, 'packages', 'app');
    fs.mkdirSync(path.join(nested, 'src'), { recursive: true });
    fs.writeFileSync(path.join(nested, 'package.json'), '{"name":"app","version":"2.0.0"}\n');

    run(nested, ['--src-folder', 'src', '--output-json']);

    expect(readMeta(nested, '.').version).toBe('2.0.0');
    expect(fs.existsSync(path.join(dir, 'meta.json'))).toBe(false);
  });

  it('formats the file with two-space indentation and a trailing newline', () => {
    const dir = makeProject();

    run(dir, ['--src-folder', 'src', '--output-json']);

    const contents = fs.readFileSync(metaPath(dir, '.'), 'utf8');
    expect(contents).toMatch(/^\{\n  "version": "1\.2\.3",\n/u);
    expect(contents.endsWith('}\n')).toBe(true);
  });

  it('overwrites an existing meta.json', () => {
    const dir = makeProject();
    fs.writeFileSync(metaPath(dir, '.'), '{"version":"stale"}\n');

    run(dir, ['--src-folder', 'src', '--output-json']);

    expect(readMeta(dir, '.').version).toBe('1.2.3');
  });
});

describe('--json-out-dir', () => {
  // Naming a directory is itself the request for the file, so the two flags
  // never have to be passed together.
  it('implies --output-json', () => {
    const dir = makeProject();

    const result = run(dir, ['--src-folder', 'src', '--json-out-dir', 'src']);

    expect(result.status).toBe(0);
    expect(readMeta(dir).version).toBe('1.2.3');
    expect(fs.existsSync(metaPath(dir, '.'))).toBe(false);
  });

  it('accepts --json-out-dir=<dir>', () => {
    const dir = makeProject();

    const result = run(dir, ['--src-folder', 'src', '--json-out-dir=src']);

    expect(result.status).toBe(0);
    expect(readMeta(dir).version).toBe('1.2.3');
  });

  it('accepts a nested relative path', () => {
    const dir = makeProject({ srcFolder: path.join('build', 'dist') });

    const result = run(dir, ['--src-folder', 'build/dist', '--json-out-dir', 'build/dist']);

    expect(result.status).toBe(0);
    expect(readMeta(dir, 'build/dist').version).toBe('1.2.3');
  });

  it('accepts an absolute path outside the repository', () => {
    const dir = makeProject();
    const outside = tempDir();

    const result = run(dir, ['--src-folder', 'src', '--json-out-dir', outside]);

    expect(result.status).toBe(0);
    const written = JSON.parse(fs.readFileSync(path.join(outside, 'meta.json'), 'utf8')) as Meta;
    expect(written.version).toBe('1.2.3');
  });

  it('is harmless alongside an explicit --output-json', () => {
    const dir = makeProject();

    const result = run(dir, ['--src-folder', 'src', '--output-json', '--json-out-dir', 'src']);

    expect(result.status).toBe(0);
    expect(readMeta(dir).version).toBe('1.2.3');
  });

  // An empty value is not a directory name, so it resolves the same way the
  // absent flag does: the working directory.
  it('treats an empty value as the working directory', () => {
    const dir = makeProject();

    const result = run(dir, ['--src-folder', 'src', '--json-out-dir=']);

    expect(result.status).toBe(0);
    expect(readMeta(dir, '.').version).toBe('1.2.3');
  });

  it('rejects --json-out-dir without a value', () => {
    const dir = makeProject();

    const result = run(dir, ['--src-folder', 'src', '--json-out-dir']);

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/Option '--json-out-dir <value>' argument missing/u);
    expect(fs.existsSync(jsPath(dir))).toBe(false);
  });

  // meta.js is written first, so a bad --json-out-dir fails after it has
  // already landed. The exit code is what keeps the build from continuing.
  it('fails when the directory does not exist, after meta.js is written', () => {
    const dir = makeProject();

    const result = run(dir, ['--src-folder', 'src', '--json-out-dir', 'nope']);

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/ENOENT.*meta\.json/su);
    expect(fs.existsSync(jsPath(dir))).toBe(true);
  });
});
