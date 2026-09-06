import { afterAll, describe, expect, it } from 'bun:test';
import fs from 'node:fs';

import { cleanup, dtsPath, makeProject, run, typecheck } from './helpers';

afterAll(cleanup);

// meta.d.ts ships next to meta.js on every run. It is a global script, never a
// module, so a consumer whose tsconfig already covers the folder gets the
// window['build-meta'] typing with nothing to import and nothing to configure.
describe('meta.d.ts', () => {
  it('writes meta.d.ts into the --src-folder', () => {
    const dir = makeProject();

    const result = run(dir, ['--src-folder', 'src']);

    expect(result.status).toBe(0);
    expect(fs.existsSync(dtsPath(dir))).toBe(true);
  });

  // Any top level import or export would turn the file into a module, and the
  // Window augmentation inside it would stop being global.
  it('stays a global script', () => {
    const dir = makeProject();

    run(dir, ['--src-folder', 'src']);

    const contents = fs.readFileSync(dtsPath(dir), 'utf8');
    expect(contents).not.toMatch(/^\s*(import|export)\b/mu);
  });

  it('types every key the artifact carries', () => {
    const dir = makeProject();

    run(dir, ['--src-folder', 'src']);

    const result = typecheck(
      dir,
      'src',
      `const meta = window['build-meta'];
       const version: string | undefined = meta?.version;
       const buildDate: string | undefined = meta?.buildDate;
       const buildDateISO: string | undefined = meta?.buildDateISO;
       const buildEnv: string | undefined = meta?.buildEnv;
       const branchName: string | undefined = meta?.branchName;
       const lastCommitAuthor: string | undefined = meta?.lastCommitAuthor;
       const lastCommitHash: string | undefined = meta?.lastCommitHash;
       void [version, buildDate, buildDateISO, buildEnv, branchName, lastCommitAuthor, lastCommitHash];
      `,
    );

    expect(result.stdout + result.stderr).toBe('');
    expect(result.status).toBe(0);
  });

  // The key is optional, because nothing guarantees the script was loaded
  // before the code that reads it.
  it('marks the global itself optional', () => {
    const dir = makeProject();

    run(dir, ['--src-folder', 'src']);

    const result = typecheck(dir, 'src', `const meta: string = window['build-meta'].version;\n`);

    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toMatch(/possibly 'undefined'/u);
  });

  it('rejects a key the meta does not carry', () => {
    const dir = makeProject();

    run(dir, ['--src-folder', 'src']);

    const result = typecheck(dir, 'src', `void window['build-meta']?.releaseChannel;\n`);

    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toMatch(/releaseChannel/u);
  });

  // The declaration describes the object that was actually emitted, so a
  // package.json with no version produces types with no version either rather
  // than promising a field that is not there.
  it('drops version when the package.json has none', () => {
    const dir = makeProject({ pkg: { name: 'fixture' } });

    run(dir, ['--src-folder', 'src']);

    const result = typecheck(dir, 'src', `void window['build-meta']?.version;\n`);

    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toMatch(/version/u);
  });

  it('names the object type so consumers can annotate with it', () => {
    const dir = makeProject();

    run(dir, ['--src-folder', 'src']);

    const result = typecheck(
      dir,
      'src',
      `function report(meta: BuildMeta): string {
         return meta.branchName;
       }
       void report;
      `,
    );

    expect(result.stdout + result.stderr).toBe('');
    expect(result.status).toBe(0);
  });

  it('overwrites an existing meta.d.ts', () => {
    const dir = makeProject();
    fs.writeFileSync(dtsPath(dir), 'interface BuildMeta { stale: true }\n');

    run(dir, ['--src-folder', 'src']);

    expect(fs.readFileSync(dtsPath(dir), 'utf8')).not.toMatch(/stale/u);
  });
});
