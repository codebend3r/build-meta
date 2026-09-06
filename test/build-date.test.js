'use strict';

const { after, describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  cleanup,
  makeProject,
  readMeta,
  run,
  torontoStampsBetween,
} = require('./helpers');

after(cleanup);

// buildDate is 'MM-DD-YYYY hh:mm:ss AM ET', always Eastern Time, so stamps
// from different machines and CI regions stay comparable.
describe('buildDate', () => {
  it('matches the documented format', () => {
    const dir = makeProject();

    run(dir, ['--src-folder', 'src']);

    assert.match(
      readMeta(dir).buildDate,
      /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])-\d{4} (0[1-9]|1[0-2]):[0-5]\d:[0-5]\d (AM|PM) ET$/,
    );
  });

  it('stamps the Toronto wall clock reading of the moment it ran', () => {
    const dir = makeProject();

    const startedAt = Date.now();
    run(dir, ['--src-folder', 'src']);
    const finishedAt = Date.now();

    const expected = torontoStampsBetween(startedAt, finishedAt);
    assert.ok(
      expected.has(readMeta(dir).buildDate),
      `${readMeta(dir).buildDate} is not one of ${[...expected].join(', ')}`,
    );
  });

  // The timezone is hardcoded, so the machine's own TZ must not show through.
  for (const TZ of ['UTC', 'Asia/Tokyo', 'America/Los_Angeles']) {
    it(`ignores TZ=${TZ} on the host`, () => {
      const dir = makeProject();

      const startedAt = Date.now();
      run(dir, ['--src-folder', 'src'], { TZ });
      const finishedAt = Date.now();

      const expected = torontoStampsBetween(startedAt, finishedAt);
      assert.ok(
        expected.has(readMeta(dir).buildDate),
        `TZ=${TZ} produced ${readMeta(dir).buildDate}, expected one of ${[...expected].join(', ')}`,
      );
    });
  }
});
