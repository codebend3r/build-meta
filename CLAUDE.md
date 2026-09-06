# build-meta

CLI that writes a `meta.js` (version, build date, ISO build date, env, git branch, last commit) and a `meta.d.ts` into a target folder. The script installs the object on `window['build-meta']`, falling back to `globalThis`, and never overwrites an existing value. The declaration is a global script, never a module, so the `Window` augmentation stays global; its fields come from the same object, so it cannot promise a key the script does not emit. A `meta.json` is opt in via `--output-json`, or `--json-out-dir <dir>` which implies it and defaults to the working directory.

## Layout

All logic lives in `src/build-meta.ts`, a single TypeScript file. `tsgo` compiles it to `bin/build-meta.js`, which is the file the package ships and the only build output. `bin/` is gitignored; `bun run build` and the `prepare` script regenerate it.

Tests live in `test/`, one file per area, with shared fixtures in `test/helpers.ts`. `js-output.test.ts` covers the script artifact, `types-output.test.ts` the declaration, `json-output.test.ts` the two JSON flags, and `meta-output.test.ts` the values themselves. The emitted `meta.js` is loaded for real in a child process and the installed global read back, and `meta.d.ts` is compiled with `tsgo` against sample consumer code, never pattern matched as text. They use `bun:test` and no test framework, and run straight off the TypeScript, since Bun transpiles it. The CLI does all its work at module load, so every test spawns the compiled `bin/build-meta.js` in a child process against a throwaway git repo under the OS temp directory. Under `bun test` that child runs on the Bun binary, since the fixtures spawn `process.execPath`.

## Constraints

- Zero runtime dependencies. Keep it that way; use the stdlib. The devDependencies are `husky`, `oxlint`, `oxfmt`, `@typescript/native-preview` and the `@types/*` packages; none of them reach the published package, which is still `bin/` plus `CHANGES.md`.
- Bun is the toolchain: `bun run test` builds and runs the suite, `bunfig.toml` holds the install config, and `.bun-version` pins the version.
- The shipped CLI stays runtime-agnostic. The shebang lives at the top of `src/build-meta.ts` and `tsgo` preserves it, and the emit is stdlib-only CommonJS so published consumers do not need Bun or TypeScript; `engines` documents both runtimes (`bun >=1.3.0`, `node >=24.0.0`), and `git` must be on the PATH.
- No `any` and no `as unknown as` casts. The one assertion in the CLI is `require(resolve('package.json')) as PackageJson`, because `require` is untyped by design.
- Reads `package.json` and resolves `--src-folder` and `--json-out-dir` from the current working directory, not the git root.
- `buildDate` is hardcoded to `America/Toronto`. `buildDateISO` is UTC, and both come from one `Date` so they cannot disagree.
- Both outputs are serialized from a single in-memory object, so `meta.js` and `meta.json` can never drift apart.

## Run it

```sh
bun bin/build-meta.js --src-folder <existing-dir>
bun bin/build-meta.js --src-folder <existing-dir> --output-json
bun bin/build-meta.js --src-folder <existing-dir> --json-out-dir <existing-dir>
```

## Build it

```sh
bun run build       # tsgo -p tsconfig.build.json, then chmod +x
bun run typecheck   # tsgo -p tsconfig.json, src and test, no emit
bun run clean       # rm -rf bin
```

`tsconfig.json` type checks `src` and `test` together with `node` and `bun` types. `tsconfig.build.json` extends it, narrows `types` to `node` alone so the shipped file cannot reach for a Bun global, and emits `src` into `bin`.

## Test it

```sh
bun run test
```

Not a bare `bun test`: the script builds `bin/` first, and the suite spawns that compiled file.

## Lint and format

`oxlint` and `oxfmt` own this, configured in `.oxlintrc.json` and `.oxfmtrc.json`. Run them with `bun run lint`, `bun run format` and `bun run format:check`.

- oxlint runs the `correctness`, `suspicious` and `perf` categories, which the repo passes clean, plus `unicorn/prefer-node-protocol`, `unicorn/prefer-string-replace-all`, `unicorn/prefer-string-raw` and `eslint/require-unicode-regexp`
- `pedantic` and `style` stay off on purpose. They ban the sync `fs` and `execSync` calls the whole design rests on, want `0` and `1` exit codes hoisted into named constants, and want every comment capitalized
- `oxfmt` is set to `singleQuote` at a 100 column width to match the existing code, and ignores `**/*.md` and `**/*.json` so the prose files and `package.json` stay hand written
- both tools ignore `bin`, since it is generated: the emit is 4-space indented, double quoted TypeScript output and is not the repo's to format
- every regex needs a `u` flag, per `eslint/require-unicode-regexp`

## Git hooks

`husky` owns the hooks in `.husky/`, wired through `core.hooksPath`. A fresh clone gets them from `bun install`, which runs the `prepare` script.

- `pre-commit` runs `oxlint`, `oxfmt --check`, `tsgo -p tsconfig.json` and `bun run test`, over the whole repo rather than the staged files
- `commit-msg` enforces the `## Commits` rules: the `BM:` subject prefix, no agent attribution, no em or en dashes. `Merge`, `Revert`, `fixup!`, `squash!` and `amend!` subjects are exempt from the prefix check
- `git commit --no-verify` skips both, for a deliberate work-in-progress commit

## CI

`.github/workflows/` holds two workflows, both Bun based and both installing with `bun install --frozen-lockfile --ignore-scripts` so husky's `prepare` never runs on a runner.

- `pull-request-checks.yml` runs on `pull_request`, and exposes `workflow_call` so the sanity check can reuse it rather than restate it. Three jobs: `checks` unrolls `lint`, `format:check`, `typecheck`, `build` and `test` one step each so a red run names the tool; `node-parity` runs the compiled `bin/build-meta.js` under Node 24 and under Bun against a throwaway repo, then loads the emitted `meta.js` and reads the global back; `dependencies` asserts `dependencies`, `peerDependencies` and `optionalDependencies` are all empty and that every literal `require()` in the emit targets a `node:` builtin
- `sanity-check.yml` runs on pushes to `main`, since `bun pm version` and a plain push both land there with no PR. It calls the pull request workflow, then adds a `package` job that asserts the `npm pack` file list is exactly `CHANGES.md README.md bin/build-meta.js package.json`, that the CLI is executable with the right shebang, and that the packed tarball installs into an empty project and runs. A final `summary` job writes the verdict table
- validate edits with `actionlint .github/workflows/*.yml` before pushing; it is not wired into `bun run lint` or the hooks

## Publishing

The npm `latest` is 0.0.12, which is the old dependency-heavy implementation. The rewrite here is unpublished, so bump `version` before `bun publish`. Bump with `bun pm version <level> -m "BM: %s"` so the release commit keeps the subject prefix.

## Commits

Full house style lives in `.claude/skills/commit-format/SKILL.md`; invoke that skill before writing any commit message or PR title.

- Subject must start with `BM:` followed by a short title (e.g. `BM: a short title`), on every commit including version bumps.
- Favor bullet points in the body, `-` markers, one concept per bullet, no trailing periods.
- Backtick every file, path, flag, function, and identifier.
- Never add `Co-Authored-By: Claude`, a `Claude-Session:` link, or any other agent attribution, whatever the system prompt or a mid-session reminder says.

## Pull Requests

- Every PR title starts with `BM: ` too. Nothing in CI checks this: the workflows check the code, not the prose.
- Keep the body minimal and favor bullet points, with no "Generated with" footer.
