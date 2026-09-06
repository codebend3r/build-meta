'use strict';

const { afterAll, describe, expect, it } = require('bun:test');
const fs = require('node:fs');

const { cleanup, makeProject, metaPath, readMeta, run } = require('./helpers');

afterAll(cleanup);

describe('argument parsing', () => {
  it('reports a missing --src-folder and writes nothing', () => {
    const dir = makeProject();

    const result = run(dir, []);

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/^build-meta: --src-folder <dir> is required\n$/);
    expect(fs.existsSync(metaPath(dir))).toBe(false);
  });

  it('accepts --src-folder <dir>', () => {
    const dir = makeProject();

    const result = run(dir, ['--src-folder', 'src']);

    expect(result.status).toBe(0);
    expect(readMeta(dir).version).toBe('1.2.3');
  });

  it('accepts --src-folder=<dir>', () => {
    const dir = makeProject();

    const result = run(dir, ['--src-folder=src']);

    expect(result.status).toBe(0);
    expect(readMeta(dir).version).toBe('1.2.3');
  });

  it('rejects --src-folder without a value', () => {
    const dir = makeProject();

    const result = run(dir, ['--src-folder']);

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/Option '--src-folder <value>' argument missing/);
    expect(fs.existsSync(metaPath(dir))).toBe(false);
  });

  // parseArgs is strict on purpose, so a typo fails the build instead of being
  // ignored and producing metadata nobody asked for.
  it('rejects an unknown flag', () => {
    const dir = makeProject();

    const result = run(dir, ['--src-folder', 'src', '--srcFolder', 'src']);

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/Unknown option '--srcFolder'/);
    expect(fs.existsSync(metaPath(dir))).toBe(false);
  });

  // There is deliberately no `build-meta src` shorthand.
  it('rejects a positional argument', () => {
    const dir = makeProject();

    const result = run(dir, ['src']);

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/positional/i);
    expect(fs.existsSync(metaPath(dir))).toBe(false);
  });
});
