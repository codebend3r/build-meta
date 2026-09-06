import { afterAll, describe, expect, it } from 'bun:test';

import { cleanup, makeProject, readMeta, run, torontoStampsBetween } from './helpers';

afterAll(cleanup);

// buildDate is 'MM-DD-YYYY hh:mm:ss AM ET', always Eastern Time, so stamps
// from different machines and CI regions stay comparable.
describe('buildDate', () => {
  it('matches the documented format', () => {
    const dir = makeProject();

    run(dir, ['--src-folder', 'src']);

    expect(readMeta(dir).buildDate).toMatch(
      /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])-\d{4} (0[1-9]|1[0-2]):[0-5]\d:[0-5]\d (AM|PM) ET$/u,
    );
  });

  it('stamps the Toronto wall clock reading of the moment it ran', () => {
    const dir = makeProject();

    const startedAt = Date.now();
    run(dir, ['--src-folder', 'src']);
    const finishedAt = Date.now();

    expect([...torontoStampsBetween(startedAt, finishedAt)]).toContain(readMeta(dir).buildDate);
  });

  // The timezone is hardcoded, so the machine's own TZ must not show through.
  for (const TZ of ['UTC', 'Asia/Tokyo', 'America/Los_Angeles']) {
    it(`ignores TZ=${TZ} on the host`, () => {
      const dir = makeProject();

      const startedAt = Date.now();
      run(dir, ['--src-folder', 'src'], { TZ });
      const finishedAt = Date.now();

      expect([...torontoStampsBetween(startedAt, finishedAt)]).toContain(readMeta(dir).buildDate);
    });
  }
});
