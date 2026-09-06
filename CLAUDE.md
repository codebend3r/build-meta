# build-meta

CLI that writes a `meta.json` (version, build date, env, git branch, last commit) into a target folder.

## Layout

All logic lives in `bin/build-meta.js`, a single CJS file. There is no build step, no tests, and no source directory.

## Constraints

- Zero runtime dependencies. Keep it that way; use the Node stdlib.
- Node 24 or newer (`engines.node`), plus `git` on the PATH.
- Reads `package.json` and resolves `--src-folder` from the current working directory, not the git root.
- `buildDate` is hardcoded to `America/Toronto`.

## Run it

```sh
node bin/build-meta.js --src-folder <existing-dir>
```

## Publishing

The npm `latest` is 0.0.12, which is the old dependency-heavy implementation. The rewrite here is unpublished, so bump `version` before `npm publish`.
