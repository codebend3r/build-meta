'use strict';

const { after, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { cleanup, makeProject, metaPath, readMeta, run } = require('./helpers');

after(cleanup);

describe('argument parsing', () => {
  it('reports a missing --src-folder and writes nothing', () => {
    const dir = makeProject();

    const result = run(dir, []);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /^build-meta: --src-folder <dir> is required\n$/);
    assert.equal(fs.existsSync(metaPath(dir)), false);
  });

  it('accepts --src-folder <dir>', () => {
    const dir = makeProject();

    const result = run(dir, ['--src-folder', 'src']);

    assert.equal(result.status, 0);
    assert.equal(readMeta(dir).version, '1.2.3');
  });

  it('accepts --src-folder=<dir>', () => {
    const dir = makeProject();

    const result = run(dir, ['--src-folder=src']);

    assert.equal(result.status, 0);
    assert.equal(readMeta(dir).version, '1.2.3');
  });

  it('rejects --src-folder without a value', () => {
    const dir = makeProject();

    const result = run(dir, ['--src-folder']);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Option '--src-folder <value>' argument missing/);
    assert.equal(fs.existsSync(metaPath(dir)), false);
  });

  // parseArgs is strict on purpose, so a typo fails the build instead of being
  // ignored and producing metadata nobody asked for.
  it('rejects an unknown flag', () => {
    const dir = makeProject();

    const result = run(dir, ['--src-folder', 'src', '--srcFolder', 'src']);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Unknown option '--srcFolder'/);
    assert.equal(fs.existsSync(metaPath(dir)), false);
  });

  // There is deliberately no `build-meta src` shorthand.
  it('rejects a positional argument', () => {
    const dir = makeProject();

    const result = run(dir, ['src']);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /positional/i);
    assert.equal(fs.existsSync(metaPath(dir)), false);
  });
});
