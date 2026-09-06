import { afterAll, describe, expect, it } from 'bun:test';
import fs from 'node:fs';

import { cleanup, jsPath, loadMetaJs, makeProject, metaPath, readMetaJs, run } from './helpers';

afterAll(cleanup);

// meta.js is what a plain run produces: the same object the CLI would have
// written as JSON, wrapped in a script that installs itself on the global so a
// consumer needs one side effect load and no import binding.
describe('meta.js', () => {
  it('writes meta.js into the --src-folder', () => {
    const dir = makeProject();

    const result = run(dir, ['--src-folder', 'src']);

    expect(result.status).toBe(0);
    expect(fs.existsSync(jsPath(dir))).toBe(true);
  });

  it('writes no meta.json unless one is asked for', () => {
    const dir = makeProject();

    run(dir, ['--src-folder', 'src']);

    expect(fs.existsSync(metaPath(dir))).toBe(false);
  });

  it('installs the meta on window under the build-meta key', () => {
    const dir = makeProject({ author: 'Ada Lovelace' });

    run(dir, ['--src-folder', 'src']);

    const meta = readMetaJs(dir);
    expect(meta.version).toBe('1.2.3');
    expect(meta.branchName).toBe('main');
    expect(meta.lastCommitAuthor).toBe('Ada Lovelace');
  });

  it('carries the same keys in the same order as the JSON', () => {
    const dir = makeProject();

    run(dir, ['--src-folder', 'src']);

    expect(Object.keys(readMetaJs(dir))).toEqual([
      'version',
      'buildDate',
      'buildDateISO',
      'buildEnv',
      'branchName',
      'lastCommitAuthor',
      'lastCommitHash',
    ]);
  });

  // The `||` in the emitted assignment is the point: a page that already put
  // something under the key keeps it, exactly like the hand written boilerplate
  // this replaces.
  it('leaves an existing build-meta value alone', () => {
    const dir = makeProject();

    run(dir, ['--src-folder', 'src']);

    expect(
      loadMetaJs(jsPath(dir), { window: true, existing: `{ version: 'already here' }` }),
    ).toEqual({ version: 'already here' });
  });

  // Loaded outside a browser there is no window at all, and reaching for one
  // would throw. The artifact falls back to globalThis so a bundler that
  // evaluates it during SSR gets the meta rather than a ReferenceError.
  it('falls back to globalThis where there is no window', () => {
    const dir = makeProject();

    run(dir, ['--src-folder', 'src']);

    expect(loadMetaJs(jsPath(dir))).toMatchObject({ version: '1.2.3' });
  });

  // Wrapped in an IIFE, so the local it uses to pick a global does not become a
  // property of the page's global scope.
  it('leaks nothing but the build-meta key', () => {
    const dir = makeProject();

    run(dir, ['--src-folder', 'src']);

    const file = jsPath(dir);
    expect(
      loadMetaJs(file, {
        window: true,
        existing: `globalThis.g === undefined ? 'clean' : 'leaked'`,
      }),
    ).toBe('clean');
  });

  it('overwrites an existing meta.js', () => {
    const dir = makeProject();
    fs.writeFileSync(jsPath(dir), `globalThis['build-meta'] = { version: 'stale' };\n`);

    run(dir, ['--src-folder', 'src']);

    expect(readMetaJs(dir).version).toBe('1.2.3');
  });

  it('ends the file with a newline', () => {
    const dir = makeProject();

    run(dir, ['--src-folder', 'src']);

    expect(fs.readFileSync(jsPath(dir), 'utf8').endsWith('\n')).toBe(true);
  });
});
