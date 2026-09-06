import { afterAll, describe, expect, it } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';

import { cleanup, makeProject, metaPath, run, tempDir } from './helpers';

afterAll(cleanup);

// Everything except the missing --src-folder surfaces as an uncaught
// exception. The point of each assertion is the non-zero exit plus the fact
// that no stale meta.json is left behind for a build to pick up.
describe('failure modes', () => {
  it('fails when the working directory has no package.json', () => {
    const dir = makeProject({ pkg: null });

    const result = run(dir, ['--src-folder', 'src']);

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/Cannot find module .*package\.json/u);
    expect(fs.existsSync(metaPath(dir))).toBe(false);
  });

  it('fails outside a git repository and passes git stderr through', () => {
    const dir = tempDir();
    fs.mkdirSync(path.join(dir, 'src'));
    fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"fixture","version":"1.2.3"}\n');

    const result = run(dir, ['--src-folder', 'src']);

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/not a git repository/iu);
    expect(fs.existsSync(metaPath(dir))).toBe(false);
  });

  it('fails when git is not on the PATH', () => {
    const dir = makeProject();

    const result = run(dir, ['--src-folder', 'src'], { PATH: '/nonexistent' });

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/git.*not found/iu);
    expect(fs.existsSync(metaPath(dir))).toBe(false);
  });

  // The folder must already exist; the CLI deliberately does not create it.
  it('fails when the target folder does not exist', () => {
    const dir = makeProject({ srcFolder: null });

    const result = run(dir, ['--src-folder', 'src']);

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/ENOENT/u);
    expect(fs.existsSync(path.join(dir, 'src'))).toBe(false);
  });

  it('fails when the target folder is a file', () => {
    const dir = makeProject();
    fs.writeFileSync(path.join(dir, 'notes.txt'), 'not a folder\n');

    const result = run(dir, ['--src-folder', 'notes.txt']);

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/ENOTDIR/u);
    expect(fs.readFileSync(path.join(dir, 'notes.txt'), 'utf8')).toBe('not a folder\n');
  });

  // The git work happens before the write, so a bad --src-folder fails at the
  // very end: the error is the write's, and nothing has been printed yet.
  it('runs the git commands before it discovers a bad target folder', () => {
    const dir = makeProject({ srcFolder: null });

    const result = run(dir, ['--src-folder', 'src']);

    expect(result.stderr).toMatch(/ENOENT.*meta\.json/su);
    expect(result.stderr).not.toMatch(/not a git repository/iu);
    expect(result.stdout).toBe('');
  });
});
