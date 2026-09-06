import { afterAll, describe, expect, it } from 'bun:test';

import { cleanup, makeProject, readMetaJs, run } from './helpers';

afterAll(cleanup);

// buildEnv falls back in a fixed order: --env, then NODE_ENV, then PROFILE,
// then the literal 'development'.
describe('buildEnv resolution', () => {
  it('prefers --env over both environment variables', () => {
    const dir = makeProject();

    run(dir, ['--src-folder', 'src', '--env', 'production'], {
      NODE_ENV: 'test',
      PROFILE: 'staging',
    });

    expect(readMetaJs(dir).buildEnv).toBe('production');
  });

  it('uses NODE_ENV when --env is absent', () => {
    const dir = makeProject();

    run(dir, ['--src-folder', 'src'], { NODE_ENV: 'test', PROFILE: 'staging' });

    expect(readMetaJs(dir).buildEnv).toBe('test');
  });

  it('uses PROFILE when neither --env nor NODE_ENV is set', () => {
    const dir = makeProject();

    run(dir, ['--src-folder', 'src'], { PROFILE: 'staging' });

    expect(readMetaJs(dir).buildEnv).toBe('staging');
  });

  it('falls back to development when nothing is set', () => {
    const dir = makeProject();

    run(dir, ['--src-folder', 'src']);

    expect(readMetaJs(dir).buildEnv).toBe('development');
  });

  // An empty --env is falsy, so it does not pin buildEnv to an empty string;
  // it drops through to the rest of the chain like an absent flag.
  it('treats an empty --env as absent and keeps falling back', () => {
    const dir = makeProject();

    run(dir, ['--src-folder', 'src', '--env='], { NODE_ENV: 'test' });

    expect(readMetaJs(dir).buildEnv).toBe('test');
  });

  it('treats an empty --env with no environment variables as development', () => {
    const dir = makeProject();

    run(dir, ['--src-folder', 'src', '--env=']);

    expect(readMetaJs(dir).buildEnv).toBe('development');
  });

  // An empty NODE_ENV is falsy for the same reason, so PROFILE still wins.
  it('skips an empty NODE_ENV in favour of PROFILE', () => {
    const dir = makeProject();

    run(dir, ['--src-folder', 'src'], { NODE_ENV: '', PROFILE: 'staging' });

    expect(readMetaJs(dir).buildEnv).toBe('staging');
  });
});
