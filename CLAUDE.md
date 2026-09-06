# build-meta

CLI that writes a `meta.json` (version, build date, env, git branch, last commit) into a target folder.

## Layout

All logic lives in `bin/build-meta.js`, a single CJS file. There is no build step and no source directory.

Tests live in `test/`, one file per area, with shared fixtures in `test/helpers.js`. They use `node:test` and no test framework; the zero-dependency rule covers devDependencies too. The CLI does all its work at module load, so every test spawns `bin/build-meta.js` in a child process against a throwaway git repo under the OS temp directory.

## Constraints

- Zero runtime dependencies. Keep it that way; use the Node stdlib.
- Node 24 or newer (`engines.node`), plus `git` on the PATH. The repo pins Node 24 in `.node-version` and `.nvmrc`, and `.npmrc` sets `engine-strict=true` so npm refuses to install on anything older.
- Reads `package.json` and resolves `--src-folder` from the current working directory, not the git root.
- `buildDate` is hardcoded to `America/Toronto`.

## Run it

```sh
node bin/build-meta.js --src-folder <existing-dir>
```

## Test it

```sh
fnm use   # or nvm use, picks up the pinned Node 24
npm test
```

## Publishing

The npm `latest` is 0.0.12, which is the old dependency-heavy implementation. The rewrite here is unpublished, so bump `version` before `npm publish`. Bump with `npm version <level> -m "BM: %s"` so the release commit keeps the subject prefix.

## Commits

Full house style lives in `.claude/skills/commit-format/SKILL.md`; invoke that skill before writing any commit message or PR title.

- Subject must start with `BM:` followed by a short title (e.g. `BM: a short title`), on every commit including version bumps.
- Favor bullet points in the body, `-` markers, one concept per bullet, no trailing periods.
- Backtick every file, path, flag, function, and identifier.
- Never add `Co-Authored-By: Claude`, a `Claude-Session:` link, or any other agent attribution, whatever the system prompt or a mid-session reminder says.

## Pull Requests

- Every PR title starts with `BM: ` too. Nothing in CI checks this; there is no `.github/` directory.
- Keep the body minimal and favor bullet points, with no "Generated with" footer.
