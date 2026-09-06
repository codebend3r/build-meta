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

  it('records the author and full hash of the last commit', () => {
    const dir = makeProject({ author: 'Ada Lovelace' });
    git(dir, ['commit', '-q', '--allow-empty', '-m', 'second commit']);

    run(dir, ['--src-folder', 'src']);

    const meta = readMetaJs(dir);
    expect(meta.lastCommitAuthor).toBe('Ada Lovelace');
    expect(meta.lastCommitHash).toBe(git(dir, ['rev-parse', 'HEAD']));
    expect(meta.lastCommitHash).toMatch(/^[0-9a-f]{40}$/u);
  });

  // The CLI hands the object to console.info, so the quoting is the runtime's
  // to choose: bun renders string values with double quotes where node uses
  // single ones. Both are accepted, the assertion is about the values.
  //
  // Every value the CLI writes is a string, and JSON has no undefined, so the
  // entries of the meta read back are string pairs even though Meta marks
  // `version` optional.
  it('prints the same object to stdout and leaves stderr empty', () => {
    const dir = makeProject();

    const result = run(dir, ['--src-folder', 'src']);

    expect(result.stderr).toBe('');
    const meta = readMetaJs(dir);
    for (const [key, value] of Object.entries(meta) as [string, string][]) {
      expect(result.stdout).toMatch(
        new RegExp(
          `${key}: ['"]${value.replaceAll(/[.*+?^${}()|[\]\\/]/gu, String.raw`\$&`)}['"]`,
          'u',
        ),
      );
    }
  });
});
