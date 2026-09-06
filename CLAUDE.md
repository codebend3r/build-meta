# build-meta

CLI that writes a `meta.json` (version, build date, env, git branch, last commit) into a target folder.

## Layout

All logic lives in `bin/build-meta.js`, a single CJS file. There is no build step and no source directory.

Tests live in `test/`, one file per area, with shared fixtures in `test/helpers.js`. They use `bun:test` and no test framework; `husky` is the only devDependency the repo carries. The CLI does all its work at module load, so every test spawns `bin/build-meta.js` in a child process against a throwaway git repo under the OS temp directory. Under `bun test` that child runs on the Bun binary, since the fixtures spawn `process.execPath`.

## Constraints

- Zero runtime dependencies. Keep it that way; use the stdlib. `husky` is the one devDependency, for git hooks, and nothing it installs reaches the published package.
- Bun is the toolchain: `bun test` runs the suite, `bunfig.toml` holds the install config, and `.bun-version` pins the version.
- The shipped CLI stays runtime-agnostic. `bin/build-meta.js` keeps its `#!/usr/bin/env node` shebang and stdlib-only CommonJS so published consumers do not need Bun; `engines` documents both (`bun >=1.3.0`, `node >=24.0.0`), and `git` must be on the PATH.
- Reads `package.json` and resolves `--src-folder` from the current working directory, not the git root.
- `buildDate` is hardcoded to `America/Toronto`.

## Run it

```sh
bun bin/build-meta.js --src-folder <existing-dir>
```

## Test it

```sh
bun test
```

## Git hooks

`husky` owns the hooks in `.husky/`, wired through `core.hooksPath`. A fresh clone gets them from `bun install`, which runs the `prepare` script.

- `pre-commit` runs `bun test`
- `commit-msg` enforces the `## Commits` rules: the `BM:` subject prefix, no agent attribution, no em or en dashes. `Merge`, `Revert`, `fixup!`, `squash!` and `amend!` subjects are exempt from the prefix check
- `git commit --no-verify` skips both, for a deliberate work-in-progress commit

## Publishing

The npm `latest` is 0.0.12, which is the old dependency-heavy implementation. The rewrite here is unpublished, so bump `version` before `bun publish`. Bump with `bun pm version <level> -m "BM: %s"` so the release commit keeps the subject prefix.

## Commits

Full house style lives in `.claude/skills/commit-format/SKILL.md`; invoke that skill before writing any commit message or PR title.

- Subject must start with `BM:` followed by a short title (e.g. `BM: a short title`), on every commit including version bumps.
- Favor bullet points in the body, `-` markers, one concept per bullet, no trailing periods.
- Backtick every file, path, flag, function, and identifier.
- Never add `Co-Authored-By: Claude`, a `Claude-Session:` link, or any other agent attribution, whatever the system prompt or a mid-session reminder says.

## Pull Requests

- Every PR title starts with `BM: ` too. Nothing in CI checks this; there is no `.github/` directory.
- Keep the body minimal and favor bullet points, with no "Generated with" footer.
