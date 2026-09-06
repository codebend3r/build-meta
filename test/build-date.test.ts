import { afterAll, describe, expect, it } from 'bun:test';

import {
  cleanup,
  makeProject,
  readMetaJs,
  run,
  torontoStamp,
  torontoStampsBetween,
} from './helpers';

afterAll(cleanup);

// buildDate is 'MM-DD-YYYY hh:mm:ss AM ET', always Eastern Time, so stamps
// from different machines and CI regions stay comparable.
describe('buildDate', () => {
  it('matches the documented format', () => {
    const dir = makeProject();

    run(dir, ['--src-folder', 'src']);

    expect(readMetaJs(dir).buildDate).toMatch(
      /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])-\d{4} (0[1-9]|1[0-2]):[0-5]\d:[0-5]\d (AM|PM) ET$/u,
    );
  });

  it('stamps the Toronto wall clock reading of the moment it ran', () => {
    const dir = makeProject();

    const startedAt = Date.now();
    run(dir, ['--src-folder', 'src']);
    const finishedAt = Date.now();

    expect([...torontoStampsBetween(startedAt, finishedAt)]).toContain(readMetaJs(dir).buildDate);
  });

  // The timezone is hardcoded, so the machine's own TZ must not show through.
  for (const TZ of ['UTC', 'Asia/Tokyo', 'America/Los_Angeles']) {
    it(`ignores TZ=${TZ} on the host`, () => {
      const dir = makeProject();

      const startedAt = Date.now();
      run(dir, ['--src-folder', 'src'], { TZ });
      const finishedAt = Date.now();

      expect([...torontoStampsBetween(startedAt, finishedAt)]).toContain(readMetaJs(dir).buildDate);
    });
  }
});

// buildDateISO is the machine readable half of the same instant: UTC, always
// suffixed Z, and safe to hand to Date.parse.
describe('buildDateISO', () => {
  it('matches the ISO-8601 UTC format', () => {
    const dir = makeProject();

    run(dir, ['--src-folder', 'src']);

    expect(readMetaJs(dir).buildDateISO).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u);
  });

  it('stamps the moment the CLI ran', () => {
    const dir = makeProject();

    const startedAt = Date.now();
    run(dir, ['--src-folder', 'src']);
    const finishedAt = Date.now();

    const stampedAt = Date.parse(readMetaJs(dir).buildDateISO);
    expect(stampedAt).toBeGreaterThanOrEqual(startedAt);
    expect(stampedAt).toBeLessThanOrEqual(finishedAt);
  });

  // The two stamps come from one Date, so they cannot land on either side of a
  // tick and describe different seconds.
  it('describes the same instant as buildDate', () => {
    const dir = makeProject();

    run(dir, ['--src-folder', 'src']);

    const meta = readMetaJs(dir);
    expect(torontoStamp(new Date(meta.buildDateISO))).toBe(meta.buildDate);
  });

  // UTC by definition, so unlike buildDate there is nothing here for the host
  // timezone to shift.
  it('is unaffected by TZ on the host', () => {
    const dir = makeProject();

    const startedAt = Date.now();
    run(dir, ['--src-folder', 'src'], { TZ: 'Asia/Tokyo' });
    const finishedAt = Date.now();

    const stampedAt = Date.parse(readMetaJs(dir).buildDateISO);
    expect(stampedAt).toBeGreaterThanOrEqual(startedAt);
    expect(stampedAt).toBeLessThanOrEqual(finishedAt);
  });
});
